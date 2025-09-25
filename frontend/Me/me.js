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


// 页面切换逻辑
const buttons = document.querySelectorAll('.bottom-nav button');
const pages = document.querySelectorAll('.page');

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-page');
    pages.forEach(p => p.classList.remove('active'));
    buttons.forEach(b => b.classList.remove('active'));
    const page = document.getElementById(target);
    if(page) page.classList.add('active');
    btn.classList.add('active');
  });
});
