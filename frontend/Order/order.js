/* ======================
   初始化用户信息
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.accessToken = localStorage.getItem("accessToken");

let ordering = false;

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
   一键刷单
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
    const res = await fetch(
      "https://owrjqbkkwdunahvzzjzc.supabase.co/functions/v1/rapid-action",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
   渲染最近订单
   ====================== */
function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = parseFloat(coinsRaw) || 0;
  const price = parseFloat(order.total_price) || 0;
  const profit = parseFloat(order.profit) || 0;
  const profitRatio = parseFloat(order.products?.profit) || 0;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润比例：${profitRatio}</p>
    <p>收入：+¥${profit.toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前金币：¥${coins.toFixed(2)}</p>
  `;

  el.innerHTML = html;
}

/* ======================
   加载最近订单列表
   ====================== */
async function loadRecentOrders() {
  if (!window.currentUserId) return;

  const { data: recentOrders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(5);

  const list = document.getElementById("recentOrders");
  if (!list) return;

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

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
});
