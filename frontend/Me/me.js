// me.js

// 检查登录状态
let user = JSON.parse(localStorage.getItem('user'));
if (!user) {
  window.location.href = '/index.html'; // 根目录 index.html
}

// 获取用户信息 div
const userInfoDiv = document.getElementById('userInfo');

// 异步函数获取最新用户信息
async function fetchUserInfo() {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('username, account, balance')
      .eq('uuid', user.uuid)
      .single();

    if (error || !data) {
      console.error(error);
      userInfoDiv.innerHTML = '<p>获取用户信息失败</p>';
      return;
    }

    // 更新 localStorage 中的用户数据
    user = data;
    localStorage.setItem('user', JSON.stringify(user));

    // 渲染用户信息
    userInfoDiv.innerHTML = `
      <p><strong>用户名：</strong> ${user.username}</p>
      <p><strong>账号：</strong> ${user.account}</p>
      <p><strong>余额：</strong> ${user.balance ?? 0} 元</p>
    `;
  } catch (err) {
    console.error(err);
    userInfoDiv.innerHTML = '<p>获取用户信息失败</p>';
  }
}

// 页面加载时获取最新信息
fetchUserInfo();

// 退出登录
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  });
}
