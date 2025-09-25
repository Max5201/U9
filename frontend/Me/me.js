// 检查登录状态
const user = JSON.parse(localStorage.getItem('user'));
if (!user) {
  window.location.href = '/index.html'; // 根目录 index.html
}

// 退出登录
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = '/index.html'; // 根目录 index.html
  });
}


