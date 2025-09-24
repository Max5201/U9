/* ====================== 1.初始化用户信息 ====================== */
window.currentUserUUID = localStorage.getItem("currentUserUUID");
let ordering = false;
let completing = false;
let cooldownTimer = null;

/* ====================== 2.工具函数 ====================== */
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

/* ====================== 3.轮次倒计时 ====================== */
function startRoundCountdown(roundEndTime) {
  const endTime = new Date(roundEndTime).getTime();

  const tick = () => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);
    if (remaining > 0) {
      setOrderBtnDisabled(true, `本轮冷却中`, `冷却剩余时间：${formatTime(remaining)}`);
      requestAnimationFrame(tick);
    } else {
      setOrderBtnDisabled(false);
      refreshAll(); // 轮次结束刷新订单和 Coins
    }
  };
  tick();
}

/* ====================== 4.显示最近订单和轮次 ====================== */
function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = coinsRaw != null ? Number(coinsRaw) : 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;
  const roundInfo = order.current_order_in_round != null ? `${order.current_order_in_round}/${order.total_orders_in_round}单` : "";

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>轮次：${roundInfo}</p>
    <p>商品：${order.name || order.product_name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>收入：+¥${profit.toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
    <p>时间：${new Date(order.created_at || Date.now()).toLocaleString()}</p>
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
      await autoOrder(); // 完成订单后自动下单下一单
    });
  }
}

/* ====================== 5.自动下单 ====================== */
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

    renderLastOrder({
      order_id: order.order_id,
      product_id: order.product_id,
      product_name: order.product_name,
      total_price: order.total_price,
      profit: order.profit,
      round_id: order.round_id,
      status: "pending",
      current_order_in_round: order.current_order_in_round,
      total_orders_in_round: order.total_orders_in_round,
      created_at: order.match_start_time
    }, order.coins_after);

    updateCoinsUI(order.coins_after);

    // 如果轮次已满或者结束，启动轮次冷却
    const remainingOrders = order.total_orders_in_round - order.current_order_in_round;
    if (remainingOrders <= 0) {
      startRoundCountdown(order.match_end_time);
    }

  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
  }
}

/* ====================== 6.完成订单 ====================== */
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
      name: order.product_name || "商品",
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

/* ====================== 7.刷新 Coins & 最近订单 ====================== */
async function refreshAll() {
  await loadCoinsOrderPage();
  await loadLastOrder();
}

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

async function loadLastOrder() {
  if (!window.currentUserUUID) return;

  const { data: orders } = await supabaseClient
    .from("orders")
    .select("id, product_id, status, total_price, profit, round_id, created_at")
    .eq("user_uuid", window.currentUserUUID)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("uuid", window.currentUserUUID)
    .single();

  if (orders?.length) {
    renderLastOrder({
      order_id: orders[0].id,
      name: "商品",
      total_price: orders[0].total_price,
      profit: orders[0].profit,
      status: orders[0].status
    }, user?.coins);
  } else {
    document.getElementById("orderResult").innerHTML = "";
  }
}

/* ====================== 8.页面事件绑定 ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  refreshAll();
});
