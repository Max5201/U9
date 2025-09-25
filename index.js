document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const messageEl = document.getElementById("message");
  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");

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

  // 生成新的 session_token
  function generateToken() {
    return crypto.randomUUID(); // v2 JS 原生生成 uuid
  }

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
      const { data, error } = await supabaseClient
        .from("users")
        .select("uuid, username, account, balance, coins")
        .eq("username", username)
        .eq("password", password)
        .single();

      if (error || !data) {
        messageEl.textContent = "用户名或密码错误";
        return;
      }

      // 生成新的 session_token
      const newToken = generateToken();

      // 更新数据库 session_token
      const { error: updateError } = await supabaseClient
        .from("users")
        .update({ session_token: newToken })
        .eq("uuid", data.uuid);

      if (updateError) {
        console.error(updateError);
        messageEl.textContent = "登录失败，请稍后再试";
        return;
      }

      // 保存到 localStorage
      localStorage.setItem(
        "user",
        JSON.stringify({ ...data, session_token: newToken })
      );
      window.location.href = "frontend/HOME.html";

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
      // 检查用户名是否存在
      const { data: existing } = await supabaseClient
        .from("users")
        .select("uuid")
        .eq("username", username)
        .maybeSingle();

      if (existing) {
        messageEl.textContent = "用户名已存在";
        return;
      }

      // 插入新用户
      const { data, error } = await supabaseClient
        .from("users")
        .insert([{ username, password }])
        .select("uuid, username, account, balance, coins")
        .single();

      if (error || !data) {
        messageEl.textContent = "注册失败，请稍后再试";
        return;
      }

      // 生成 session_token
      const newToken = generateToken();
      const { error: updateError } = await supabaseClient
        .from("users")
        .update({ session_token: newToken })
        .eq("uuid", data.uuid);

      if (updateError) {
        console.error(updateError);
        messageEl.textContent = "注册失败，请稍后再试";
        return;
      }

      // 保存到 localStorage
      localStorage.setItem(
        "user",
        JSON.stringify({ ...data, session_token: newToken })
      );
      window.location.href = "frontend/HOME.html";

    } catch (err) {
      console.error(err);
      messageEl.textContent = "注册失败，请稍后再试";
    }
  });
});
