/* ====================== 1.初始化用户信息 ====================== */
window.currentUserId = Number(localStorage.getItem("currentUserId"));
window.currentUsername = localStorage.getItem("currentUser");
window.ORDERS_PER_ROUND = 5;        // 默认每轮订单数
window.MATCH_MIN_SECONDS = 5;        // 匹配最短时间
window.MATCH_MAX_SECONDS = 15;       // 匹配最长时间

let ordering = false;
let completing = false;
let exchanging = false;
let cooldownTimer = null;

/* ====================== 2.读取轮次配置 ====================== */
async function loadRoundConfig() {
  try {
    const { data, error } = await supabaseClient
      .from("round_config")
      .select("orders_per_round, match_min_seconds, match_max_seconds")
      .limit(1)
      .single();

    if (error) throw error;

    if (data) {
      window.ORDERS_PER_ROUND = Number(data.orders_per_round);
      window.MATCH_MIN_SECONDS = Number(data.match_min_seconds) || 5;
      window.MATCH_MAX_SECONDS = Number(data.match_max_seconds) || 15;
    }
  } catch (e) {
    console.error("读取轮次配置失败:", e.message);
  }
}

/* ====================== 3.工具函数 ====================== */
function setOrderBtnDisabled(disabled, reason = "", cooldownText = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason;
    btn.textContent = disabled ? `🎲 一键刷单（不可用）` : "🎲 一键刷单";
  }
  const cdEl = document.getElementById("cooldownDisplay");
  if (cdEl) cdEl.textContent = cooldownText;
}

function updateCoinsUI(coinsRaw) {
  const coins = Number(coinsRaw) || 0;
  const ob = document.getElementById("ordercoins");
  if (ob) ob.textContent = coins.toFixed(2);

  if (coins < 0) {
    setOrderBtnDisabled(true, `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)}）`);
  } else {
    setOrderBtnDisabled(false);
  }
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/* ====================== 4.获取用户规则产品 ====================== */
async function getUserRuleProduct(userId, orderNumber) {
  const { data: rules, error } = await supabaseClient
    .from("user_product_rules")
    .select("product_id")
    .eq("user_id", userId)
    .eq("order_number", orderNumber)
    .eq("enabled", true)
    .limit(1);

  if (error) { console.error("读取手动规则失败", error); return null; }
  return rules?.[0]?.product_id || null;
}

/* ====================== 5.获取随机产品 ====================== */
async function getRandomProduct() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("enabled", true)
    .eq("manual_only", false);

  if (error || !products?.length) throw new Error("产品列表为空或读取失败！");
  return products[Math.floor(Math.random() * products.length)];
}

/* ====================== 6.更新轮次进度 ====================== */
async function updateRoundProgress() {
  if (!window.currentUserId) return;

  try {
    const { data: user, error } = await supabaseClient
      .from("users")
      .select("current_round")
      .eq("id", window.currentUserId)
      .single();

    if (error || !user) throw new Error(error?.message || "获取用户轮次失败");

    const el = document.getElementById("roundProgress");
    if (el) el.textContent = `本轮已完成订单：${user.current_round || 0} / ${window.ORDERS_PER_ROUND}`;
  } catch (e) {
    console.error("更新轮次失败：", e.message);
  }
}

/* ====================== 7.渲染最近订单 ====================== */
function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = Number(coinsRaw) || 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0; 
  const profitRatio = Number(order.products?.profit) || 0; 

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润率：${profitRatio}</p>
    <p>收入：+¥${profit.toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前金币：¥${coins.toFixed(2)}</p>
  `;

  if (order.status === "pending" && coins >= 0) {
    html += `<button id="completeOrderBtn">完成订单</button>`;
  }
  if (coins < 0) {
    html += `<p style="color:red;">⚠️ 金币为负，欠款 ¥${Math.abs(coins).toFixed(2)}</p>`;
  }

  el.innerHTML = html;

  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    compBtn.addEventListener("click", async () => {
      compBtn.disabled = true;
      await completeOrder(order, coins);
    });
  }
}

/* ====================== 8.完成订单 ====================== */
async function completeOrder(order, currentCoinsRaw) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") return;

    const currentCoins = Number(currentCoinsRaw) || 0;
    const price = Number(order.total_price) || 0;
    const profit = Number(order.profit) || 0;
    const finalCoins = currentCoins + price + profit;

    // 更新订单状态
    const { error: orderErr } = await supabaseClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (orderErr) throw new Error(orderErr.message);

    // 更新用户 coins 和轮次
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins, current_round")
      .eq("id", window.currentUserId)
      .single();

    const newRound = (user.current_round || 0) + 1;

    await supabaseClient
      .from("users")
      .update({ coins: finalCoins, current_round: newRound })
      .eq("id", window.currentUserId);

    renderLastOrder({ ...order, status: "completed" }, finalCoins);
    updateCoinsUI(finalCoins);
    await checkPendingLock();
    await loadRecentOrders();
    await updateRoundProgress();
  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ====================== 9.检查 pending 锁定 ====================== */
async function checkPendingLock() {
  if (!window.currentUserId) return;

  const { data: pend } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_id", window.currentUserId)
    .eq("status", "pending")
    .limit(1);

  if (pend?.length) {
    setOrderBtnDisabled(true, "存在未完成订单，请先完成订单");
  } else {
    setOrderBtnDisabled(false);
  }
}

/* ====================== 10.自动下单 ====================== */
async function autoOrder() {
  if (!window.currentUserId) {
    alert("请先登录！");
    return;
  }
  if (ordering) return;
  ordering = true;

  try {
    await loadRoundConfig();

    // 获取用户 coins 和轮次
    const { data: user } = await supabaseClient
      .from("users")
      .select("current_round, coins")
      .eq("id", window.currentUserId)
      .single();

    if (!user) throw new Error("用户不存在");

    if ((user.current_round || 0) >= window.ORDERS_PER_ROUND) {
      alert("本轮已完成全部订单，开始新轮次");
      await supabaseClient
        .from("users")
        .update({ current_round: 0 })
        .eq("id", window.currentUserId);

      await updateRoundProgress();
      ordering = false;
      return;
    }

    if ((user.coins || 0) < 50) {
      alert("你的余额不足，最少需要 50 coins");
      setOrderBtnDisabled(false);
      ordering = false;
      return;
    }

    // 检查未完成订单
    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) {
      alert("您有未完成订单，请先完成订单再继续下单。");
      await checkPendingLock();
      ordering = false;
      return;
    }

    // 选择商品逻辑
    let product;
    const totalOrdersRes = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId);
    const orderNumber = (totalOrdersRes?.count || 0) + 1;

    const ruleProductId = await getUserRuleProduct(window.currentUserId, orderNumber);
    if (ruleProductId) {
      const { data: pData, error } = await supabaseClient
        .from("products")
        .select("*")
        .eq("id", ruleProductId)
        .single();
      if (!error && pData) product = pData;
    }
    if (!product) product = await getRandomProduct();

    // 生成匹配时间
    let delaySec = Math.floor(
      Math.random() * (window.MATCH_MAX_SECONDS - window.MATCH_MIN_SECONDS + 1)
    ) + window.MATCH_MIN_SECONDS;

    startMatchingCountdown(product, delaySec);

  } catch (e) {
    alert(e.message || "下单失败");
    setMatchingState(false);
  } finally {
    ordering = false;
  }
}

/* ====================== 11.匹配倒计时 ====================== */
function startMatchingCountdown(product, delaySec) {
  const btn = document.getElementById("autoOrderBtn");
  btn.disabled = true;

  const countdownEl = document.getElementById("matchingCountdown");
  let sec = delaySec;

  cooldownTimer = setInterval(() => {
    countdownEl.textContent = `匹配中：${sec}s`;
    if (sec <= 0) {
      clearInterval(cooldownTimer);
      countdownEl.textContent = "";
      btn.disabled = false;
      createOrder(product); // 下单
    }
    sec--;
  }, 1000);
}

/* ====================== 12.创建订单 ====================== */
async function createOrder(product) {
  try {
    const { data, error } = await supabaseClient
      .from("orders")
      .insert([
        {
          user_id: window.currentUserId,
          product_id: product.id,
          total_price: product.price,
          profit: product.profit,
          status: "pending",
          created_at: new Date().toISOString(),
        }
      ]);

    if (error) throw error;
    await loadRecentOrders();
    await updateRoundProgress();
  } catch (e) {
    alert("下单失败：" + e.message);
  }
}

/* ====================== 13.初始化 ====================== */
document.addEventListener("DOMContentLoaded", async () => {
  updateCoinsUI(0);
  await updateRoundProgress();
  await checkPendingLock();

  // 聊天红点初始化
  updateUnreadCount();
  listenForMessages();
});
