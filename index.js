document.addEventListener("DOMContentLoaded", () => {
  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const messageEl = document.getElementById("message");

  if (!loginTab || !registerTab) {
    console.error("找不到 login-tab 或 register-tab，请检查 HTML");
    return;
  }

  // 切换登录/注册 tab
  loginTab.addEventListener("click", () => {
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
    loginForm.classList.add("active");
    registerForm.classList.remove("active");
    messageEl.textContent = "";
  });

  registerTab.addEventListener("click", () => {
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
    registerForm.classList.add("active");
    loginForm.classList.remove("active");
    messageEl.textContent = "";
  });

  // 登录
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!username || !password) {
      messageEl.textContent = "请输入用户名和密码";
      return;
    }

    try {
      const { data, error } = await window.supabaseClient
        .from("users")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .single();

      if (error || !data) {
        messageEl.textContent = "用户名或密码错误";
      } else {
        localStorage.setItem("user", JSON.stringify(data));
        window.location.href = "frontend/HOME.html";
      }
    } catch (err) {
      console.error(err);
      messageEl.textContent = "登录失败，请稍后再试";
    }
  });

  // 注册
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("register-username").value.trim();
    const password = document.getElementById("register-password").value.trim();

    if (!username || !password) {
      messageEl.textContent = "请输入用户名和密码";
      return;
    }

    try {
      const { data: existing } = await window.supabaseClient
        .from("users")
        .select("uuid")
        .eq("username", username)
        .maybeSingle();

      if (existing) {
        messageEl.textContent = "用户名已存在";
        return;
      }

      const { data, error } = await window.supabaseClient
        .from("users")
        .insert([{ username, password }])
        .select()
        .single();

      if (error || !data) {
        console.error(error);
        messageEl.textContent = "注册失败，请稍后再试";
      } else {
        localStorage.setItem("user", JSON.stringify(data));
        window.location.href = "frontend/HOME.html";
      }
    } catch (err) {
      console.error(err);
      messageEl.textContent = "注册失败，请稍后再试";
    }
  });
});
