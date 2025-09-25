window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;

function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason;
    btn.textContent = disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单";
  }
}

function updateCoinsUI(coinsRaw) {
  const coins = parseFloat(coinsRaw) || 0;
  const el = document.getElementById("ordercoins");
  if (el) el.textContent = coins.toFixed(2);
}

async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
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
    alert(`下单成功！金币剩余: ${data.newCoins}`);

  } catch (e) {
    alert(e.message);
  } finally {
    ordering = false;
    setOrderBtnDisabled(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
});
