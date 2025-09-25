// frontend/Me/me.js
(function() {
  // 获取用户登录信息
  let user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user.uuid) {
    window.location.href = '/index.html';
  }

  const userInfoDiv = document.getElementById('userInfo');

  function renderUserInfo(data) {
    userInfoDiv.innerHTML = `
      <p><strong>用户名：</strong> ${data.username}</p>
      <p><strong>账号：</strong> ${data.account}</p>
      <p><strong>余额：</strong> ${data.balance ?? 0} 元</p>
      <p><strong>金币：</strong> ${data.coins ?? 0}</p>
    `;
  }

  async function fetchUserInfo() {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('username, account, balance, coins, session_token')
        .eq('uuid', user.uuid)
        .single();

      if (error || !data) {
        console.error(error);
        userInfoDiv.innerHTML = '<p>获取用户信息失败</p>';
        return;
      }

      // 多端登录检查
      if (data.session_token !== user.session_token) {
        alert('您的账号已在其他设备登录，您已被强制退出。');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
        return;
      }

      user = {
        uuid: user.uuid,
        session_token: user.session_token,
        username: data.username,
        account: data.account,
        balance: data.balance,
        coins: data.coins
      };
      localStorage.setItem('user', JSON.stringify(user));
      renderUserInfo(user);

    } catch (err) {
      console.error(err);
      userInfoDiv.innerHTML = '<p>获取用户信息失败</p>';
    }
  }

  // 页面加载时获取
  fetchUserInfo();

  // 定时检查 session_token
  setInterval(fetchUserInfo, 5000);

  // 退出登录
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('user');
      window.location.href = '/index.html';
    });
  }

})();
