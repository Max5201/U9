window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.accessToken = localStorage.getItem("accessToken");

let ordering = false;
let completing = false;
let exchanging = false;

if (!window.supabaseClient) console.error("❌ supabaseClient 未初始化！");

// ======================
// UI 更新函数
// ======================
function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) { btn.disabled = disabled; btn.title = reason; btn.textContent = disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单"; }
}

function updateCoinsUI(coinsRaw) {
  const coins = parseFloat(coinsRaw) || 0;
  const ob = document.getElementById("ordercoins");
  if (ob) ob.textContent = coins.toFixed(2);
  setOrderBtnDisabled(coins < 0, coins < 0 ? `金币为负 ¥${Math.abs(coins).toFixed(2)}` : "");
}

function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = parseFloat(coinsRaw) || 0;
  const html = `
    <h4>✅ 最近一次订单</h4>
    <p>商品：${order.products?.name || "未知"}</p>
    <p>价格：¥${order.total_price.toFixed(2)}</p>
    <p>利润：+¥${order.profit.toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
  `;
  el.innerHTML = html;
}

// ======================
// 订单刷新
// ======================
async function loadRecentOrders() {
  if (!window.currentUserId) return;

  try {
    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id,total_price,profit,status,created_at,products(name,profit)")
      .eq("user_id", window.currentUserId)
      .order("created_at", { ascending: false })
      .limit(5);

    const list = document.getElementById("recentOrders");
    if (!list) return;
    if (!orders || orders.length === 0) list.innerHTML = "<li>暂无订单</li>";
    else list.innerHTML = orders.map(o => `
      <li>
        🛒 ${o.products?.name || "未知"} /
        ¥${o.total_price.toFixed(2)} /
        收入：+¥${o.profit.toFixed(2)} /
        状态：${o.status === "completed" ? "已完成" : "待完成"} /
        <small>${new Date(o.created_at).toLocaleString()}</small>
      </li>`).join("");

  } catch(e) { console.error("加载订单失败", e); }
}

// ======================
// 刷单逻辑
// ======================
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;
  ordering = true;
  setOrderBtnDisabled(true, "匹配中…");

  try {
    const res = await fetch("https://owrjqbkkwdunahvzzjzc.supabase.co/functions/v1/rapid-action", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${window.accessToken}`
      },
      body: JSON.stringify({ user_id: window.currentUserId })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `请求失败: ${res.status}`);
    }

    const data = await res.json();
    renderLastOrder(data.order, data.newCoins);
    updateCoinsUI(data.newCoins);
    await loadRecentOrders();

  } catch(e) {
    alert(e.message);
  } finally {
    ordering = false;
    setOrderBtnDisabled(false);
  }
}

// ======================
// Coins 弹窗
// ======================
function openExchangeModal() { document.getElementById("addCoinsModal")?.classList.remove("hidden"); }
function closeExchangeModal() { document.getElementById("addCoinsModal")?.classList.add("hidden"); }

async function confirmExchange() {
  if (exchanging) return;
  exchanging = true;

  const inputEl = document.getElementById("addCoinsInput");
  const amount = parseFloat(inputEl?.value || 0);
  if (!window.currentUserId || isNaN(amount) || amount <= 0) { alert("输入无效"); exchanging=false; return; }

  try {
    const { data: user, error } = await supabaseClient
      .from("users")
      .select("coins,balance")
      .eq("id", window.currentUserId)
      .single();
    if (error || !user) throw new Error("加载用户信息失败");

    if (user.balance < amount) { alert(`余额不足`); return; }

    const newCoins = +(user.coins + amount).toFixed(2);
    const newBalance = +(user.balance - amount).toFixed(2);

    const { error: updateErr } = await supabaseClient
      .from("users")
      .update({ coins: newCoins, balance: newBalance })
      .eq("id", window.currentUserId);
    if (updateErr) throw updateErr;

    updateCoinsUI(newCoins);
    document.getElementById("balance").textContent = newBalance.toFixed(2);
    closeExchangeModal();

  } catch(e) { alert(e.message || "兑换失败"); }
  finally { exchanging = false; }
}

// ======================
// 初始化页面
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("addCoinsBtn")?.addEventListener("click", openExchangeModal);
  document.getElementById("cancelAddCoins")?.addEventListener("click", closeExchangeModal);
  document.getElementById("confirmAddCoins")?.addEventListener("click", confirmExchange);
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "../index.html";
  });

  // 显示用户信息
  document.getElementById("username").textContent = window.currentUsername || "-";
  document.getElementById("platformAccount").textContent = localStorage.getItem("platformAccount") || "-";

  // 加载 Coins、Balance
  if (window.currentUserId) {
    const { data, error } = await supabaseClient
      .from("users")
      .select("coins,balance")
      .eq("id", window.currentUserId)
      .single();
    if (!error && data) {
      updateCoinsUI(data.coins);
      document.getElementById("balance").textContent = (parseFloat(data.balance)||0).toFixed(2);
    }
  }

  await loadRecentOrders();
});
