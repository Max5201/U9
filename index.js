// =======================
// 注册逻辑
// =======================
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (!username || !password) { alert("请输入用户名和密码"); return; }
  if (password !== confirm) { alert("两次输入的密码不一致"); return; }
  if (!agree) { alert("请先勾选同意条款"); return; }

  // 使用 Supabase Auth 注册
  const { data, error } = await supabaseClient.auth.signUp({
    email: username + "@example.com",
    password
  });

  if (error) { alert("注册失败: " + error.message); return; }

  // 保存用户信息和 token
  localStorage.setItem("currentUserId", data.user.id);
  localStorage.setItem("currentUser", username);
  localStorage.setItem("accessToken", data.session?.access_token || "");

  alert("注册成功！");
  window.location.href = "/frontend/home";
});

// =======================
// 登录逻辑
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) { alert("请输入用户名和密码"); return; }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: username + "@example.com",
    password
  });

  if (error) { alert("登录失败: " + error.message); return; }
  if (!data.user) { alert("用户不存在"); return; }

  // 保存用户信息和 token
  localStorage.setItem("currentUserId", data.user.id);
  localStorage.setItem("currentUser", username);
  localStorage.setItem("accessToken", data.session?.access_token || "");

  alert("登录成功！");
  window.location.href = "/frontend/home";
});
