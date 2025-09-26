// =======================
// 密码可见切换
// =======================
window.togglePassword = function (id, el) {
  const input = document.getElementById(id);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    el.textContent = "🙈";
  } else {
    input.type = "password";
    el.textContent = "👁️";
  }
};

// =======================
// 登录 / 注册 Tab 切换
// =======================
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const showLoginBtn = document.getElementById("showLogin");
const showRegisterBtn = document.getElementById("showRegister");

showLoginBtn.addEventListener("click", () => {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  showLoginBtn.classList.add("active");
  showRegisterBtn.classList.remove("active");
});

showRegisterBtn.addEventListener("click", () => {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
  showLoginBtn.classList.remove("active");
  showRegisterBtn.classList.add("active");
});

// =======================
// 生成随机平台账号（2位大写字母 + 4位数字，如 AB1234）
// =======================
function generatePlatformAccount() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let acc = "";
  for (let i = 0; i < 2; i++) acc += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) acc += numbers[Math.floor(Math.random() * numbers.length)];
  return acc;
}

// =======================
// 注册逻辑
// =======================
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (!username || !password) {
    alert("请输入用户名和密码");
    return;
  }
  if (password !== confirm) {
    alert("两次输入的密码不一致");
    return;
  }
  if (!agree) {
    alert("请先勾选同意条款");
    return;
  }

  // 检查是否已有用户
  const { data: exist } = await supabaseClient
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (exist) {
    alert("该用户名已存在，请换一个");
    return;
  }

  const platformAccount = generatePlatformAccount();
  const currentRoundId = crypto.randomUUID();

  // 插入新用户
  const { data, error } = await supabaseClient
    .from("users")
    .insert({
      username,
      password, // ⚠️ 明文存储不安全，建议 hash
      coins: 0,
      balance: 0,
      platform_account: platformAccount,
      current_round_id: currentRoundId,
      round_start_time: Date.now()
    })
    .select()
    .single();

  if (error) {
    alert("注册失败: " + error.message);
    return;
  }

  // 保存到 localStorage
  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", currentRoundId);
  window.currentUserUUID = currentRoundId;
  window.currentRoundId = currentRoundId;

  alert("注册成功！");
  window.location.href = "frontend/HOME.html";
});

// =======================
// 登录逻辑
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    alert("请输入用户名和密码");
    return;
  }

  const { data, error } = await supabaseClient
    .from("users")
    .select("id, username, password, platform_account, uuid, current_round_id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    alert("登录失败: " + error.message);
    return;
  }
  if (!data) {
    alert("用户不存在");
    return;
  }
  if (data.password !== password) {
    alert("密码错误");
    return;
  }

  // 初始化 UUID 和轮次
  const uuid = data.current_round_id || crypto.randomUUID();
  window.currentUserUUID = data.uuid || uuid;
  window.currentRoundId = uuid;
  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", window.currentUserUUID);
  localStorage.setItem("currentRoundId", window.currentRoundId);

  // 如果数据库没有 current_round_id，更新
  if (!data.current_round_id) {
    await supabaseClient
      .from("users")
      .update({ current_round_id: uuid, round_start_time: Date.now() })
      .eq("uuid", window.currentUserUUID);
  }

  alert("登录成功！");
  window.location.href = "frontend/HOME.html";
});
