// 从 Supabase 读取 users 表
document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.querySelector("#userListTable tbody");

  try {
    // 从 Supabase 读取 users 表
    const { data: users, error } = await supabaseClient
      .from("users")
      .select("username, account, coins, balance");

    if (error) {
      console.error("获取用户列表失败:", error);
      tbody.innerHTML = `<tr><td colspan="4">无法获取用户数据</td></tr>`;
      return;
    }

    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">暂无用户</td></tr>`;
      return;
    }

    // 遍历用户填充表格
    tbody.innerHTML = users
      .map(
        (user) => `
      <tr>
        <td>${user.username}</td>
        <td>${user.account}</td>
        <td>${user.coins?.toFixed(2) || "0.00"}</td>
        <td>${user.balance?.toFixed(2) || "0.00"}</td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="4">读取用户数据出错</td></tr>`;
  }
});

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


