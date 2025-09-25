// 页面元素
const startBtn = document.getElementById('startBtn');
const orderInfo = document.getElementById('orderInfo'); // 显示订单信息或提示
let roundsConfig = null;

// 获取轮次配置
async function fetchRoundsConfig() {
  const { data, error } = await supabaseClient
    .from('rounds')
    .select('*')
    .limit(1)
    .single();

  if (error || !data) {
    console.error(error);
    return;
  }
  roundsConfig = data;
  checkStartAvailability();
}

// 检查 START 按钮是否可点击
function checkStartAvailability() {
  const now = new Date();
  const lastCompleted = user.last_round_completed ? new Date(user.last_round_completed) : null;
  const cooldown = roundsConfig ? roundsConfig.cooldown_seconds * 1000 : 60000;

  if (user.coins < 30) {
    startBtn.disabled = true;
    orderInfo.textContent = 'Coins 不够，无法开始刷单';
  } else if (lastCompleted && now - lastCompleted < cooldown) {
    startBtn.disabled = true;
    const remaining = Math.ceil((cooldown - (now - lastCompleted)) / 1000);
    orderInfo.textContent = `冷却中，剩余 ${remaining} 秒`;
    // 可以加定时器倒计时
    setTimeout(checkStartAvailability, 1000);
  } else {
    startBtn.disabled = false;
    orderInfo.textContent = '';
  }
}

// START 按钮点击
startBtn.addEventListener('click', () => {
  // 初始化轮次
  user.current_round_count = 0;
  localStorage.setItem('user', JSON.stringify(user));
  startBtn.textContent = 'GO';
  startBtn.disabled = false;
});

// 初始化
fetchRoundsConfig();
