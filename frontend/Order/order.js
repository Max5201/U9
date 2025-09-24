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
    btn.textContent = disabled
      ? `🎲 一键刷单（不可用）`
      : "🎲 一键刷单";
  }
  const cdEl = document.getElementById("cooldownDisplay");
  if (cdEl) cdEl.textContent = cooldownText;
}

function updateCoinsUI(coinsRaw) {
  const coins = Number(coinsRaw) || 0;
  const ob = document.getElementById("ordercoins");
  if (ob) ob.textContent = coins.toFixed(2);
  if (coins < 0) setOrderBtnDisabled(true, `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)}）`);
  else setOrderBtnDisabled(false);
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/* ====================== 匹配倒计时 ====================== */
function startMatchingCountdown(order, matchSec = 5) {
  setOrderBtnDisabled(true, "匹配中...", "");
  const endTime = Date.now() + matchSec * 1000;

  const tick = () => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);
    const gifEl = document.getElementById("matchingGif");
    if (gifEl) gifEl.style.display = remaining > 0 ? "block" : "none";

    if (remaining > 0) {
      requestAnimationFrame(tick);
    } else {
      renderLastOrder(order);
      setOrderBtnDisabled(false);
    }
  };
  tick();
}

/* ====================== 渲染最近订单 ====================== */
function renderLastOrder(order) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;
  const coins = Number(order.coins_after) || 0;
  const roundInfo = order.current_order_in_round && order.total_orders_in_round
    ? `${order.current_order_in_round}/${order.total_orders_in_round}单`
    : "";

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>轮次：${roundInfo}</p>
    <p>商品：${order.product_name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>收入：+¥${profit.toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
    <p>时间：${new Date(order.created_at || Date.now()).toLocaleString()}</p>
    <p>当前金币：¥${coins.toFixed(2)}</p>
  `;

  if (order.status === "pending") {
    html += `<button id="completeOrderBtn">完成订单</button>`;
  }

  el.innerHTML = html;

  const btn = document.getElementById("completeOrderBtn");
  if (btn) btn.addEventListener("click", async () => {
    btn.disabled = true;
    await completeOrder(order.order_id);
    await autoOrder();
  });
}

/* ====================== 自动下单 ====================== */
async function autoOrder() {
  if (!window.currentUserUUID) return;
  if (ordering) return;
  ordering = true;

  try {
    const { data, error } = await supabaseClient.rpc("create_matched_order", {
      p_user_uuid: window.currentUserUUID
    });
    if (error) throw error;
    if (!data || !data.length) throw new Error("下单失败");

    const order = data[0];

    // 前端倒计时使用服务器返回的匹配时间
    const matchSec = order.match_sec || 5;

    startMatchingCountdown(order, matchSec);
    updateCoinsUI(order.coins_after);

    // 轮次冷却处理
    if (order.round_cooldown_until) {
      startRoundCountdown(new Date(order.round_cooldown_until));
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
      product_name: order.product_name || "商品",
      total_price: order.total_price,
      profit: order.profit,
      status: order.status,
      coins_after: order.coins_after
    });
    updateCoinsUI(order.coins_after);
  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ====================== 轮次倒计时 ====================== */
function startRoundCountdown(endTime) {
  if (cooldownTimer) clearInterval(cooldownTimer);
  const tick = () => {
    const remaining = Math.ceil((new Date(endTime).getTime() - Date.now()) / 1000);
    if (remaining > 0) {
      setOrderBtnDisabled(true, "本轮冷却中", `冷却剩余时间：${formatTime(remaining)}`);
    } else {
      setOrderBtnDisabled(false);
      clearInterval(cooldownTimer);
      refreshAll();
    }
  };
  tick();
  cooldownTimer = setInterval(tick, 1000);
}

/* ====================== 刷新 Coins & 最近订单 ====================== */
async function refreshAll() {
  await loadCoinsOrderPage();
  await loadLastOrder();
}

async function loadCoinsOrderPage() {
  if (!window.currentUserUUID) return;
  const { data } = await supabaseClient.from("users").select("coins").eq("uuid", window.currentUserUUID).single();
  if (data) updateCoinsUI(data.coins);
}

async function loadLastOrder() {
  if (!window.currentUserUUID) return;
  const { data: orders } = await supabaseClient
    .from("orders")
    .select("id, product_name, status, total_price, profit, created_at")
    .eq("user_uuid", window.currentUserUUID)
    .order("created_at", { ascending: false })
    .limit(1);

  if (orders?.length) renderLastOrder({
    order_id: orders[0].id,
    product_name: orders[0].product_name,
    total_price: orders[0].total_price,
    profit: orders[0].profit,
    status: orders[0].status,
    coins_after: orders[0].coins_after
  });
}

/* ====================== 页面事件绑定 ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  refreshAll();
});
