/* ======================
   初始化用户信息
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.accessToken = localStorage.getItem("accessToken"); // JWT

let ordering = false;
let completing = false;
let exchanging = false;

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

/* ======================
   工具函数
   ====================== */
function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单";
  }
}

function updateCoinsUI(coinsRaw) {
  const coins = parseFloat(coinsRaw) || 0;
  const ob = document.getElementById("ordercoins");
  if (ob) ob.textContent = coins.toFixed(2);

  if (coins < 0) {
    setOrderBtnDisabled(true, `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)}）`);
  } else {
    setOrderBtnDisabled(false);
  }
}

/* ======================
   自动下单
   ====================== */
async function autoOrder() {
  if (!window.currentUserId || !window.accessToken) { 
    alert("请先登录！"); 
    return; 
  }
  if (ordering) return;
  ordering = true;
  setOrderBtnDisabled(true, "匹配中…");

  try {
    const res = await fetch(
      "https://owrjqbkkwdunahvzzjzc.supabase.co/functions/v1/rapid-action",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${window.accessToken}`
        },
        body: JSON.stringify({ user_id: window.currentUserId })
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `请求失败: ${res.status}`);
    }

    const data = await res.json();
    renderLastOrder(data.order, data.newCoins);
    updateCoinsUI(data.newCoins);
    await checkPendingLock();
    await loadRecentOrders();

  } catch (e) {
    alert(e.message);
  } finally {
    ordering = false;
    setOrderBtnDisabled(false);
  }
}

/* ======================
   自动下单（调用受保护 Edge Function）
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { 
    alert("请先登录！"); 
    return; 
  }
  if (ordering) return;
  ordering = true;
  setOrderBtnDisabled(true, "匹配中…");

  try {
    // 获取当前用户 session
    const { data: { session }, error: sessionErr } = await supabaseClient.auth.getSession();
    if (sessionErr || !session) throw new Error("获取用户信息失败，请重新登录");

    const accessToken = session.access_token; // 用户的 JWT Token

    const res = await fetch(
      'https://owrjqbkkwdunahvzzjzc.supabase.co/functions/v1/rapid-action',
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}` // 使用用户 token
        },
        body: JSON.stringify({ user_id: window.currentUserId })
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `请求失败: ${res.status}`);
    }

    const data = await res.json();
    renderLastOrder(data.order, data.newCoins);
    updateCoinsUI(data.newCoins);
    await checkPendingLock();
    await loadRecentOrders();

  } catch (e) {
    alert(e.message);
  } finally {
    ordering = false;
    setOrderBtnDisabled(false);
  }
}

/* ======================
   最近订单
   ====================== */
async function loadRecentOrders() {
  if (!window.currentUserId) return;

  try {
    const { data: recentOrders } = await supabaseClient
      .from("orders")
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .eq("user_id", window.currentUserId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: totalCount } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId);

    const historyTitle = document.querySelector(".order-history h3");
    if (historyTitle) {
      historyTitle.textContent = `🕘 最近订单 订单数：${totalCount || 0}单`;
    }

    const list = document.getElementById("recentOrders");
    if (list) {
      if (!recentOrders || recentOrders.length === 0) {
        list.innerHTML = `<li>暂无订单！</li>`;
      } else {
        list.innerHTML = recentOrders.map(o => {
          const price = parseFloat(o.total_price) || 0;
          const profit = parseFloat(o.profit) || 0;
          const profitRatio = parseFloat(o.products?.profit) || 0;
          return `
            <li>
              🛒 ${o.products?.name || "未知商品"} /
              ¥${price.toFixed(2)} /
              利润：${profitRatio} /
              收入：+¥${profit.toFixed(2)} /
              状态：${o.status === "completed" ? "已完成" : "待完成"} /
              <small>${new Date(o.created_at).toLocaleString()}</small>
            </li>`;
        }).join("");
      }
    }
  } catch (e) {
    console.error("加载最近订单失败：", e);
  }
}

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("addCoinsBtn")?.addEventListener("click", openExchangeModal);
  document.getElementById("cancelAddCoins")?.addEventListener("click", closeExchangeModal);
  document.getElementById("confirmAddCoins")?.addEventListener("click", confirmExchange);

  document.getElementById("addCoinsModal")?.addEventListener("click", (e) => {
    if (e.target.id === "addCoinsModal") closeExchangeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeExchangeModal();
  });

  refreshAll();
});

/* ======================
   页面刷新工具
   ====================== */
async function refreshAll() {
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
}

async function loadCoinsOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq("id", window.currentUserId)
    .single();
  if (!error && data) {
    updateCoinsUI(data.coins);
    const balEl = document.getElementById("balance");
    if (balEl) balEl.textContent = (parseFloat(data.balance) || 0).toFixed(2);
    await checkPendingLock();
  }
}

async function loadLastOrder() {
  if (!window.currentUserId) return;

  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", window.currentUserId)
    .single();

  if (orders?.length) renderLastOrder(orders[0], user?.coins ?? 0);
  else document.getElementById("orderResult").innerHTML = "";
}

/* ======================
   Coins 弹窗
   ====================== */
function openExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  const input = document.getElementById("addCoinsInput");
  if (modal) {
    modal.style.display = "flex";
    if (input) { input.value = ""; setTimeout(() => input.focus(), 50); }
  }
}

function closeExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  if (modal) modal.style.display = "none";
}

async function confirmExchange() {
  if (exchanging) return;
  exchanging = true;

  const inputEl = document.getElementById("addCoinsInput");
  const confirmBtn = document.getElementById("confirmAddCoins");
  const amount = parseFloat(inputEl?.value || "0");

  if (isNaN(amount) || amount <= 0) { alert("输入无效"); exchanging = false; return; }
  if (!window.currentUserId) { alert("请先登录！"); exchanging = false; return; }

  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const { data: user, error } = await supabaseClient
      .from("users")
      .select("coins, balance")
      .eq("id", window.currentUserId)
      .single();
    if (error || !user) throw new Error("加载用户信息失败");

    const coins = parseFloat(user.coins) || 0;
    const balance = parseFloat(user.balance) || 0;
    if (balance < amount) { alert(`余额不足，当前 Balance：¥${balance.toFixed(2)}`); return; }

    const newCoins = +(coins + amount).toFixed(2);
    const newBalance = +(balance - amount).toFixed(2);

    const { error: updateErr } = await supabaseClient
      .from("users")
      .update({ coins: newCoins, balance: newBalance })
      .eq("id", window.currentUserId);
    if (updateErr) throw new Error("兑换失败：" + updateErr.message);

    alert(`✅ 成功兑换 ${amount.toFixed(2)} Coins`);
    document.getElementById("ordercoins").textContent = newCoins.toFixed(2);
    const balEl = document.getElementById("balance");
    if (balEl) balEl.textContent = newBalance.toFixed(2);

    updateCoinsUI(newCoins);
    await checkPendingLock();
    await loadLastOrder();
    await loadRecentOrders();
    closeExchangeModal();

  } catch (e) {
    alert(e.message || "兑换失败");
  } finally {
    exchanging = false;
    if (confirmBtn) confirmBtn.disabled = false;
  }
}
