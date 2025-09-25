const orderPage = document.getElementById("orderPage");
const orderContainer = document.createElement("div");
const actionBtn = document.createElement("button");
const orderCard = document.createElement("div");
const countdownEl = document.createElement("p");

orderContainer.classList.add("order-container");
orderCard.classList.add("order-card");
orderPage.appendChild(orderContainer);
orderPage.appendChild(orderCard);
orderPage.appendChild(countdownEl);
orderPage.appendChild(actionBtn);

let roundsConfig = null; // 数据库配置
let currentProduct = null; // 当前匹配产品
let currentOrder = null;   // 当前订单
let cooldownTimer = null;

// 初始化
async function initOrderPage() {
  // 获取全局配置
  const { data: rounds } = await supabaseClient.from("rounds").select("*").limit(1).maybeSingle();
  roundsConfig = rounds;

  // 获取用户最新状态
  await refreshUser();

  renderUI();
}

// 刷新用户信息
async function refreshUser() {
  const { data, error } = await supabaseClient
    .from("users")
    .select("uuid, coins, current_round_count, last_round_completed")
    .eq("uuid", user.uuid)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  user.coins = data.coins;
  user.current_round_count = data.current_round_count;
  user.last_round_completed = data.last_round_completed;
  localStorage.setItem("user", JSON.stringify(user));
}

// 渲染按钮/界面
function renderUI() {
  orderCard.innerHTML = "";
  countdownEl.textContent = "";

  // 检查冷却
  if (user.last_round_completed) {
    const last = new Date(user.last_round_completed).getTime();
    const now = Date.now();
    const remain = last + roundsConfig.cooldown_seconds * 1000 - now;

    if (remain > 0) {
      startCooldown(remain);
      actionBtn.style.display = "none";
      return;
    }
  }

  // 判断是否在一轮中
  if (!currentOrder && user.current_round_count >= roundsConfig.orders_per_round) {
    // 一轮完成
    actionBtn.textContent = "冷却中...";
    actionBtn.disabled = true;
    return;
  }

  if (!currentOrder) {
    // 没有正在进行的订单
    if (user.current_round_count === 0) {
      actionBtn.textContent = "START";
    } else {
      actionBtn.textContent = "GO";
    }
    actionBtn.disabled = user.coins < 30; // 至少需要 30 coins
    actionBtn.style.display = "inline-block";
  } else {
    // 有未完成的订单 → 显示完成按钮
    renderOrderCard(currentProduct, currentOrder);
  }
}

// 冷却倒计时
function startCooldown(ms) {
  clearInterval(cooldownTimer);
  let remain = ms / 1000;

  countdownEl.textContent = `冷却中：${Math.ceil(remain)} 秒`;
  cooldownTimer = setInterval(() => {
    remain--;
    if (remain <= 0) {
      clearInterval(cooldownTimer);
      refreshUser().then(renderUI);
    } else {
      countdownEl.textContent = `冷却中：${Math.ceil(remain)} 秒`;
    }
  }, 1000);
}

// 绑定按钮事件
actionBtn.addEventListener("click", async () => {
  if (actionBtn.textContent === "START") {
    // 开始新一轮
    await supabaseClient
      .from("users")
      .update({ current_round_count: 0 })
      .eq("uuid", user.uuid);
    await refreshUser();
    renderUI();
  } else if (actionBtn.textContent === "GO") {
    await startMatching();
  }
});

// 开始匹配
async function startMatching() {
  actionBtn.disabled = true;
  actionBtn.textContent = "正在匹配...";

  // 随机选一个产品
  const { data: product } = await supabaseClient
    .from("products")
    .select("*")
    .order("random()")
    .limit(1)
    .single();

  currentProduct = product;

  setTimeout(async () => {
    // 匹配结束，立即扣钱
    const { data: updatedUser } = await supabaseClient
      .from("users")
      .update({ coins: user.coins - product.price })
      .eq("uuid", user.uuid)
      .select()
      .single();

    user.coins = updatedUser.coins;
    localStorage.setItem("user", JSON.stringify(user));

    // 插入订单
    const { data: order } = await supabaseClient
      .from("orders")
      .insert([{ user_id: user.uuid, product_id: product.id }])
      .select()
      .single();

    currentOrder = order;

    renderUI();
  }, roundsConfig.match_seconds * 1000);
}

// 渲染订单卡片
function renderOrderCard(product, order) {
  orderCard.innerHTML = `
    <h3>匹配成功 ✅</h3>
    <img src="${product.image_url}" alt="${product.name}" width="120" />
    <p>产品：${product.name}</p>
    <p>价格：${product.price}</p>
    <p>利润：${product.profit}</p>
    <p>当前余额：${user.coins}</p>
  `;

  // 完成按钮（coins < 0 时不显示）
  if (user.coins >= 0) {
    const finishBtn = document.createElement("button");
    finishBtn.textContent = "完成";
    finishBtn.onclick = async () => {
      // 返还价格+利润
      const { data: updatedUser } = await supabaseClient
        .from("users")
        .update({
          coins: user.coins + product.price + product.profit,
          current_round_count: user.current_round_count + 1,
        })
        .eq("uuid", user.uuid)
        .select()
        .single();

      user.coins = updatedUser.coins;
      user.current_round_count = updatedUser.current_round_count;
      localStorage.setItem("user", JSON.stringify(user));

      // 更新订单状态
      await supabaseClient
        .from("orders")
        .update({ status: "completed" })
        .eq("id", order.id);

      // 检查是否完成一轮
      if (user.current_round_count >= roundsConfig.orders_per_round) {
        await supabaseClient
          .from("users")
          .update({ last_round_completed: new Date().toISOString() })
          .eq("uuid", user.uuid);
        currentOrder = null;
        currentProduct = null;
        await refreshUser();
        renderUI();
      } else {
        // 下一单
        currentOrder = null;
        currentProduct = null;
        await refreshUser();
        renderUI();
      }
    };
    orderCard.appendChild(finishBtn);
  }
}

// 初始化页面
initOrderPage();
