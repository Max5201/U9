document.addEventListener("DOMContentLoaded", () => {
  const showLogin = document.getElementById("showLogin");
  const showRegister = document.getElementById("showRegister");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  // Tab 切换
  showLogin.addEventListener("click", () => {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    showLogin.classList.add("active");
    showRegister.classList.remove("active");
  });

  showRegister.addEventListener("click", () => {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    showRegister.classList.add("active");
    showLogin.classList.remove("active");
  });

  // 密码可见切换
  document.querySelectorAll(".toggle-password").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      target.type = target.type === "password" ? "text" : "password";
    });
  });

  // 注册
  document.getElementById("registerBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regConfirmPassword").value;
    const agree = document.getElementById("agreeTerms").checked;
    const msg = document.getElementById("registerMsg");
    msg.textContent = "";

    if (!username || !password) { msg.textContent = "请输入用户名和密码"; return; }
    if (password !== confirm) { msg.textContent = "两次输入密码不一致"; return; }
    if (!agree) { msg.textContent = "请先勾选同意条款"; return; }

    try {
      const { data: exist } = await window.supabaseClient
        .from("users")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (exist) { msg.textContent = "该用户名已存在"; return; }

      const platformAccount = `acc_${Math.random().toString(36).substring(2,10)}`;

      const { data, error } = await window.supabaseClient
        .from("users")
        .insert({ username, password, coins: 0, balance: 0, platform_account: platformAccount })
        .select()
        .single();
      if (error) throw error;

      localStorage.setItem("currentUserId", data.id);
      localStorage.setItem("currentUser", data.username);
      localStorage.setItem("platformAccount", data.platform_account);

      alert("注册成功！");
      window.location.href = "frontend/HOME.html";

    } catch (err) {
      msg.textContent = err.message || "注册失败";
    }
  });

  // 登录
  document.getElementById("loginBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const msg = document.getElementById("loginMsg");
    msg.textContent = "";

    if (!username || !password) { msg.textContent = "请输入用户名和密码"; return; }

    try {
      const { data, error } = await window.supabaseClient
        .from("users")
        .select("id, username, password, platform_account")
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      if (!data) { msg.textContent = "用户不存在"; return; }
      if (data.password !== password) { msg.textContent = "密码错误"; return; }

      localStorage.setItem("currentUserId", data.id);
      localStorage.setItem("currentUser", data.username);
      localStorage.setItem("platformAccount", data.platform_account);

      alert("登录成功！");
      window.location.href = "frontend/HOME.html";

    } catch (err) {
      msg.textContent = err.message || "登录失败";
    }
  });
});
