// frontend/Order/order.js
(function() {
  let user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user.uuid) {
    window.location.href = '/index.html';
  }

  const startBtn = document.getElementById('startBtn');
  const orderInfo = document.getElementById('orderInfo');

  // 创建订单卡片容器
  const orderCardContainer = document.createElement('div');
  orderCardContainer.id = 'orderCardContainer';
  startBtn.insertAdjacentElement('afterend', orderCardContainer);

  let roundsConfig = null;
  let isMatching = false;

  // -------------------------
  // 获取轮次配置
  // -------------------------
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

  // -------------------------
  // 检查 START 是否可用（Coins / 冷却）
  // -------------------------
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

  // -------------------------
  // 点击 START / GO
  // -------------------------
  startBtn.addEventListener('click', async () => {
    if (!roundsConfig) return;

    // START → GO
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

    // 获取所有产品
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

    // 匹配倒计时
    let remainingTime = matchSeconds;
    orderInfo.textContent = `匹配中... ${remainingTime} 秒`;
    const countdown = setInterval(() => {
      remainingTime--;
      orderInfo.textContent = `匹配中... ${remainingTime} 秒`;
      if (remainingTime <= 0) clearInterval(countdown);
    }, 1000);

    // 等待匹配时间
    setTimeout(async () => {
      clearInterval(countdown);

      const newCoins = Number(user.coins) - Number(randomProduct.price);

      // 更新 Coins
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

      // 渲染订单卡片
      renderOrderCard(randomProduct);

      isMatching = false;
      startBtn.disabled = false;
    }, matchSeconds * 1000);
  });

  // -------------------------
  // 渲染订单卡片
  // -------------------------
  function renderOrderCard(product) {
    orderCardContainer.innerHTML = `
      <div class="order-card">
        <p>产品：${product.name}</p>
        <p>价格：${product.price}</p>
        <p>利润：${product.profit}</p>
        <img src="${product.image_url}" alt="${product.name}" style="width:100px">
        ${user.coins >= 0 ? `<button class="complete-btn">完成</button>` : '<p>余额不足，请充值</p>'}
      </div>
    `;

    const completeBtn = orderCardContainer.querySelector('.complete-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', async () => {
        const returnCoins = Number(product.price) + Number(product.profit);
        const updatedCoins = Number(user.coins) + returnCoins;
        const newRoundCount = user.current_round_count + 1;

        // 更新数据库
        const updates = {
          coins: updatedCoins,
          current_round_count: newRoundCount
        };

        if (newRoundCount >= roundsConfig.orders_per_round) {
          updates.last_round_completed = new Date();
        }

        const { error: finishErr } = await supabaseClient
          .from('users')
          .update(updates)
          .eq('uuid', user.uuid);

        if (finishErr) console.error(finishErr);

        // 更新本地 user
        user.coins = updatedCoins;
        user.current_round_count = newRoundCount;
        if (newRoundCount >= roundsConfig.orders_per_round) {
          user.last_round_completed = updates.last_round_completed;
        }
        localStorage.setItem('user', JSON.stringify(user));

        orderCardContainer.innerHTML = '';
        orderInfo.textContent = `完成订单 ${user.current_round_count}/${roundsConfig.orders_per_round}`;

        // 检查轮次结束
        if (user.current_round_count >= roundsConfig.orders_per_round) {
          startBtn.disabled = true;
          startBtn.textContent = 'START';
          startCooldown();
        }
      });
    }
  }

  // -------------------------
  // 冷却倒计时
  // -------------------------
  function startCooldown() {
    const cooldown = roundsConfig.cooldown_seconds || 60;
    let remaining = cooldown;
    const interval = setInterval(() => {
      remaining--;
      orderInfo.textContent = `冷却中，剩余 ${remaining} 秒`;
      if (remaining <= 0) {
        clearInterval(interval);
        user.current_round_count = 0;
        localStorage.setItem('user', JSON.stringify(user));
        checkStartAvailability();
      }
    }, 1000);
  }

  // 初始化
  fetchRoundsConfig();
})();
