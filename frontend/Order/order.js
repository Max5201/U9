// frontend/Order/order.js
// 使用模块化方式 <script type="module">

let user = JSON.parse(localStorage.getItem('user'));

const startBtn = document.getElementById('startBtn');  // START / GO
const orderInfo = document.getElementById('orderInfo');
const orderCardContainer = document.getElementById('orderCardContainer');
let roundsConfig = null;
let isMatching = false;

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

// 检查 START/GO 状态
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
    setTimeout(checkStartAvailability, 1000);
  } else {
    startBtn.disabled = false;
    orderInfo.textContent = '';
  }
}

// START/GO 点击
startBtn.addEventListener('click', async () => {
  if (!roundsConfig) return;

  if (startBtn.textContent === 'START') {
    user.current_round_count = 0;
    localStorage.setItem('user', JSON.stringify(user));
    startBtn.textContent = 'GO';
    orderInfo.textContent = '';
    return;
  }

  if (isMatching) return;
  if (user.current_round_count >= roundsConfig.orders_per_round) {
    orderInfo.textContent = '本轮已完成，请等待冷却';
    return;
  }

  isMatching = true;
  startBtn.disabled = true;
  orderInfo.textContent = '正在匹配产品...';

  // 前端随机匹配
  const { data: products, error: prodErr } = await supabaseClient
    .from('products')
    .select('*');

  if (prodErr || !products || products.length === 0) {
    orderInfo.textContent = '匹配失败，请重试';
    isMatching = false;
    startBtn.disabled = false;
    return;
  }

  const randomProduct = products[Math.floor(Math.random() * products.length)];

  const matchSeconds = roundsConfig.match_seconds || 30;
  orderInfo.textContent = `匹配中... ${matchSeconds} 秒`;

  setTimeout(async () => {
    // 扣 Coins
    const newCoins = Number(user.coins) - Number(randomProduct.price);

    const { error: updateErr } = await supabaseClient
      .from('users')
      .update({ coins: newCoins })
      .eq('uuid', user.uuid);

    if (updateErr) {
      orderInfo.textContent = '扣除 Coins 失败';
      console.error(updateErr);
      isMatching = false;
      startBtn.disabled = false;
      return;
    }

    user.coins = newCoins;
    localStorage.setItem('user', JSON.stringify(user));

    // 创建订单
    const { data: newOrder, error: orderErr } = await supabaseClient
      .from('orders')
      .insert([{ user_id: user.uuid, product_id: randomProduct.id }])
      .select()
      .single();

    if (orderErr) console.error(orderErr);

    // 显示订单卡片
    const cardHTML = `
      <div class="order-card" id="order-${newOrder?.id}">
        <p>产品：${randomProduct.name}</p>
        <p>价格：${randomProduct.price}</p>
        <p>利润：${randomProduct.profit}</p>
        <img src="${randomProduct.image_url}" alt="${randomProduct.name}" style="width:100px">
        ${newCoins >= 0 ? `<button class="complete-btn">完成</button>` : '<p>余额不足，请充值</p>'}
      </div>
    `;
    orderCardContainer.innerHTML = cardHTML;

    // 完成按钮
    const completeBtn = document.querySelector('.complete-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', async () => {
        const returnCoins = Number(randomProduct.price) + Number(randomProduct.profit);
        const updatedCoins = Number(user.coins) + returnCoins;

        const { error: finishErr } = await supabaseClient
          .from('users')
          .update({ coins: updatedCoins, current_round_count: user.current_round_count + 1 })
          .eq('uuid', user.uuid);

        if (finishErr) console.error(finishErr);

        user.coins = updatedCoins;
        user.current_round_count += 1;
        localStorage.setItem('user', JSON.stringify(user));

        await supabaseClient
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', newOrder?.id);

        orderCardContainer.innerHTML = '';
        orderInfo.textContent = `完成订单 ${user.current_round_count}/${roundsConfig.orders_per_round}`;

        if (user.current_round_count >= roundsConfig.orders_per_round) {
          orderInfo.textContent = '本轮已完成，开始冷却';
          startBtn.disabled = true;
          startBtn.textContent = 'START';
          await supabaseClient
            .from('users')
            .update({ last_round_completed: new Date() })
            .eq('uuid', user.uuid);

          setTimeout(() => {
            checkStartAvailability();
          }, roundsConfig.cooldown_seconds * 1000);
        } else {
          startBtn.disabled = false;
        }
      });
    }

    isMatching = false;
    startBtn.disabled = false;
  }, matchSeconds * 1000);
});

// 初始化
fetchRoundsConfig();
