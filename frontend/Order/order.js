/* ====================== 初始化用户信息 ====================== */
window.currentUserUUID = localStorage.getItem("currentUserUUID");
let ordering = false;
let completing = false;
let cooldownTimer = null;

/* ====================== 工具函数 ====================== */
function setOrderBtnDisabled(disabled, reason = "", cooldownText = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
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

/* ====================== 匹配倒计时 ====================== */
function startMatchingCountdown(order, delaySec) {
  const endTime = Date.now() + delaySec * 1000;
  localStorage.setItem("matchingEndTime", endTime);
  localStorage.setItem("matchingProductId", order.product_id);

  const tick = () => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);
    if (remaining > 0) {
      setMatchingState(true);
      requestAnimationFrame(tick);
    } else {
      setMatchingState(false);
      localStorage.removeItem("matchingEndTime");
      localStorage.removeItem("matchingProductId");
      renderLastOrder(order, order.coins_after);
    }
  };
  tick();
}

/* ====================== 显示/隐藏匹配状态 ====================== */
function setMatchingState(isMatching) {
  const gifEl = document.getElementById("matchingGif");
  const btn = document.getElementById("autoOrderBtn");
  if (gifEl) gifEl.style.display = isMatching ? "block" : "none";
  if (btn) btn.disabled = isMatching;
  if (btn) btn.textContent = isMatching ? "🎲 正在匹配..." : "🎲 一键刷单";
}

/* ====================== 渲染最近订单 ====================== */
function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = coinsRaw != null ? Number(coinsRaw) : 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>收入：+¥${profit.toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
    <p>时间：${new Date().toLocaleString()}</p>
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
      await completeOrder(order.order_id);
    });
  }
}

/* ====================== 自动下单 ====================== */
async function autoOrder() {
  if (!window.currentUserUUID) {
    alert("请先登录！");
    return;
  }
  if (ordering) return;
  ordering = true;

  try {
    const { data, error } = await supabaseClient.rpc("create_matched_order", {
      p_user_uuid: window.currentUserUUID
    });
    if (error) throw error;
    if (!data || !data.length) throw new Error("下单失败");

    const order = data[0];
    const delaySec = Math.ceil((new Date(order.match_end_time) - new Date(order.match_start_time)) / 1000);

    startMatchingCountdown({
      order_id: order.order_id,
      product_id: order.product_id,
      name: order.product_name,
      total_price: order.total_price,
      profit: order.profit,
      round_id: order.round_id,
      status: "pending",
      coins_after: order.coins_after
    }, delaySec);

    updateCoinsUI(order.coins_after);

    if (order.cooldown) {
      startCooldownTimer(new Date(order.match_end_time), "本轮完成，冷却中...");
    }

  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
  }
}

/* ====================== 完成订单 ====================== */
async function completeOrder(orderId) {
  if (completing) return;
  completing = true;

  try {
    const { data, error } = await supabaseClient.rpc("complete_order", { p_order_id: orderId });
    if (error) throw error;
    if (!data || !data.length) throw new Error("完成订单失败");

    const order = data[0];

    renderLastOrder({
      order_id: order.order_id,
      name: "商品",
      total_price: order.total_price,
      profit: order.profit,
      status: order.status
    }, order.coins_after);

    updateCoinsUI(order.coins_after);

  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ====================== 冷却倒计时 ====================== */
function startCooldownTimer(nextAllowed, messagePrefix = "冷却中，请等待") {
  if (!nextAllowed) return;

  const tick = () => {
    const sec = Math.ceil((new Date(nextAllowed).getTime() - Date.now()) / 1000);
    if (sec <= 0) {
      clearInterval(cooldownTimer);
      setOrderBtnDisabled(false, "", "");
      refreshAll();
    } else {
      setOrderBtnDisabled(true, `${messagePrefix} ${formatTime(sec)}`, `冷却剩余时间：${formatTime(sec)}`);
    }
  };

  tick();
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(tick, 1000);
}

/* ====================== 刷新页面状态 ====================== */
async function refreshAll() {
  await loadCoinsOrderPage();
  await loadLastOrder();
}

/* ====================== 加载 Coins & Balance ====================== */
async function loadCoinsOrderPage() {
  if (!window.currentUserUUID) return;

  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq("uuid", window.currentUserUUID)
    .single();

  if (!error && data) {
    updateCoinsUI(data.coins);
    const balEl = document.getElementById("balance");
    if (balEl) balEl.textContent = (Number(data.balance) || 0).toFixed(2);
  }
}

/* ====================== 加载最近订单 ====================== */
async function loadLastOrder() {
  if (!window.currentUserUUID) return;

  const { data: orders, error } = await supabaseClient
    .from("orders")
    .select("id, total_price, profit, status, created_at, product_id")
    .eq("user_uuid", window.currentUserUUID)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("uuid", window.currentUserUUID)
    .single();

  if (orders?.length) renderLastOrder({
    order_id: orders[0].id,
    name: "商品",
    total_price: orders[0].total_price,
    profit: orders[0].profit,
    status: orders[0].status
  }, user?.coins);
  else document.getElementById("orderResult").innerHTML = "";
}

/* ====================== 页面事件绑定 ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  restoreMatchingIfAny();
  refreshAll();
});

/* ====================== 恢复匹配状态 ====================== */
function restoreMatchingIfAny() {
  const matchingEnd = Number(localStorage.getItem("matchingEndTime"));
  const productId = localStorage.getItem("matchingProductId");

  if (matchingEnd && productId && matchingEnd > Date.now()) {
    const delaySec = Math.ceil((matchingEnd - Date.now()) / 1000);
    startMatchingCountdown({ id: null, name: "商品" }, delaySec);
  } else {
    localStorage.removeItem("matchingEndTime");
    localStorage.removeItem("matchingProductId");
  }
}
