(function() {
  let user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user.uuid) {
    window.location.href = '/index.html';
    return;
  }

  const startBtn = document.getElementById('startBtn');
  const orderInfo = document.getElementById('orderInfo');

  // -------------------------
  // 容器
  // -------------------------
  const statusContainer = document.createElement('div');
  statusContainer.id = 'statusContainer';
  startBtn.insertAdjacentElement('beforebegin', statusContainer);

  const recentOrderContainer = document.createElement('div');
  recentOrderContainer.id = 'recentOrderContainer';
  startBtn.insertAdjacentElement('afterend', recentOrderContainer);

  let roundsConfig = null;
  let isMatching = false;
  let lastOrder = null;

  // -------------------------
  // 渲染状态容器
  // -------------------------
  function renderStatus() {
    const currentRound = Number(user.current_round_count) || 0;
    const totalRound = Number(roundsConfig?.orders_per_round) || 5;

    statusContainer.innerHTML = `
      <p><strong>Coins:</strong> ${user.coins ?? 0}</p>
      <p><strong>轮次:</strong> ${currentRound}/${totalRound}</p>
      <p id="matchInfo"></p>
    `;
  }

  // -------------------------
  // 渲染最近订单
  // -------------------------
  function renderRecentOrder() {
    if (!lastOrder) {
      recentOrderContainer.innerHTML = '<p>最近订单为空</p>';
      return;
    }

    recentOrderContainer.innerHTML = `
      <p><strong>最近订单:</strong></p>
      <p>产品: ${lastOrder.name}</p>
      <p>价格: ${lastOrder.price}</p>
      <p>利润: ${lastOrder.profit}</p>
      <img src="${lastOrder.image_url}" alt="${lastOrder.name}" style="width:100px">
      ${user.coins >= 0 ? `<button class="complete-btn">完成</button>` : '<p>余额不足，请充值</p>'}
    `;

    const completeBtn = recentOrderContainer.querySelector('.complete-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', completeOrder);
    }
  }

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
    renderStatus();
    renderRecentOrder();
  }

  function checkStartAvailability() {
    const now = new Date();
    const lastCompleted = user.last_round_completed ? new Date(user.last_round_completed) : null;
    const cooldown = roundsConfig ? roundsConfig.cooldown_seconds * 1000 : 60000;

    if (user.coins < 30) {
      startBtn.disabled = true;
      renderMatchInfo('Coins 不够，无法开始刷单');
    } else if (lastCompleted && now - lastCompleted < cooldown) {
      startBtn.disabled = true;
      const remaining = Math.ceil((cooldown - (now - lastCompleted)) / 1000);
      renderMatchInfo(`冷却中，剩余 ${remaining} 秒`);
      setTimeout(checkStartAvailability, 1000);
    } else {
      startBtn.disabled = false;
      renderMatchInfo('');
    }
  }

  // -------------------------
  // 点击 START / GO
  // -------------------------
  startBtn.addEventListener('click', async () => {
    if (!roundsConfig) return;

    if (startBtn.textContent === 'START') {
      // 初始化轮次到 0，并更新数据库
      const { error } = await supabaseClient
        .from('users')
        .update({ current_round_count: 0 })
        .eq('uuid', user.uuid);

      if (!error) {
        user.current_round_count = 0;
        localStorage.setItem('user', JSON.stringify(user));
        startBtn.textContent = 'GO';
        renderStatus();
      }
      return;
    }

    if (isMatching) return;
    if (user.current_round_count >= roundsConfig.orders_per_round) {
      renderMatchInfo('本轮已完成，请等待冷却');
      return;
    }

    // 开始匹配
    isMatching = true;
    startBtn.disabled = true;

    const { data: products, error: prodErr } = await supabaseClient
      .from('products')
      .select('*');

    if (prodErr || !products || products.length === 0) {
      renderMatchInfo('匹配失败，请重试');
      isMatching = false;
      startBtn.disabled = false;
      return;
    }

    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const matchSeconds = roundsConfig.match_seconds || 30;

    let remainingTime = matchSeconds;
    renderMatchInfo(`匹配中... ${remainingTime} 秒`);
    const countdown = setInterval(() => {
      remainingTime--;
      renderMatchInfo(`匹配中... ${remainingTime} 秒`);
      if (remainingTime <= 0) clearInterval(countdown);
    }, 1000);

    setTimeout(async () => {
      clearInterval(countdown);
      const newCoins = Number(user.coins) - Number(randomProduct.price);
      const { error: updateErr } = await supabaseClient
        .from('users')
        .update({ coins: newCoins })
        .eq('uuid', user.uuid);

      if (updateErr) {
        renderMatchInfo('扣除 Coins 失败');
        isMatching = false;
        startBtn.disabled = false;
        return;
      }

      user.coins = newCoins;
      localStorage.setItem('user', JSON.stringify(user));
      lastOrder = randomProduct;

      renderRecentOrder();
      renderStatus();

      isMatching = false;
      startBtn.disabled = false;
    }, matchSeconds * 1000);
  });

  // -------------------------
  // 完成订单
  // -------------------------
  async function completeOrder() {
    const product = lastOrder;
    if (!product) return;

    const returnCoins = Number(product.price) + Number(product.profit);
    const updatedCoins = Number(user.coins) + returnCoins;
    const newRoundCount = user.current_round_count + 1;

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

    user.coins = updatedCoins;
    user.current_round_count = newRoundCount;
    if (newRoundCount >= roundsConfig.orders_per_round) {
      user.last_round_completed = updates.last_round_completed;
    }
    localStorage.setItem('user', JSON.stringify(user));

    lastOrder = product;

    recentOrderContainer.innerHTML = '';
    renderMatchInfo(`完成订单 ${user.current_round_count}/${roundsConfig.orders_per_round}`);
    renderStatus();

    if (user.current_round_count >= roundsConfig.orders_per_round) {
      startBtn.disabled = true;
      startBtn.textContent = 'START';
      startCooldown();
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
      renderMatchInfo(`冷却中，剩余 ${remaining} 秒`);
      renderStatus();
      if (remaining <= 0) {
        clearInterval(interval);
        user.current_round_count = 0;
        localStorage.setItem('user', JSON.stringify(user));
        checkStartAvailability();
      }
    }, 1000);
  }

  fetchRoundsConfig();
})();
