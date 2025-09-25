// 检查登录状态
const user = JSON.parse(localStorage.getItem('user'));
if (!user) {
  window.location.href = '/index.html';
}

// 渲染用户信息卡片
const userInfoDiv = document.getElementById('userInfo');
if (userInfoDiv && user) {
  userInfoDiv.innerHTML = `
    <div class="user-card">
      <h3>${user.username}</h3>
      <p><strong>账号：</strong> ${user.account}</p>
      <p><strong>余额：</strong> ${user.balance ?? 0} 元</p>
    </div>
  `;
}

// 退出登录
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  });
}
