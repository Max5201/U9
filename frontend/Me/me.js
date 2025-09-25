// me.js

// 获取用户登录信息
let user = JSON.parse(localStorage.getItem('user'));
if (!user || !user.uuid) {
  window.location.href = '/index.html';
}

// 获取页面 div
const userInfoDiv = document.getElementById('userInfo');

// 渲染用户信息函数
function renderUserInfo(data) {
  userInfoDiv.innerHTML = `
    <p><strong>用户名：</strong> ${data.username}</p>
    <p><strong>账号：</strong> ${data.account}</p>
    <p><strong>余额：</strong> ${data.balance ?? 0} 元</p>
    <p><strong>金币：</strong> ${data.coins ?? 0}</p>
  `;
}

// 从数据库获取最新用户信息
async function fetchUserInfo() {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('username, account, balance, coins')
      .eq('uuid', user.uuid)
      .single();

    if (error || !data) {
      console.error(error);
      userInfoDiv.innerHTML = '<p>获取用户信息失败</p>';
      return;
    }

    user = data; // 更新全局 user
    localStorage.setItem('user', JSON.stringify(user));
    renderUserInfo(user);
  } catch (err) {
    console.error(err);
    userInfoDiv.innerHTML = '<p>获取用户信息失败</p>';
  }
}

// 页面加载时获取最新信息
fetchUserInfo();

// 订阅实时更新（多端同步）
supabaseClient
  .from(`users:uuid=eq.${user.uuid}`)
  .on('UPDATE', payload => {
    user = payload.new;
    localStorage.setItem('user', JSON.stringify(user));
    renderUserInfo(user);
  })
  .subscribe();

// 退出登录
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  });
}
