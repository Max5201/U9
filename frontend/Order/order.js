// frontend/Order/order.js
(function() {
  const startBtn = document.getElementById('startBtn');
  const statusContainer = document.createElement('div');
  const recentOrderContainer = document.createElement('div');
  const orderInfoDiv = document.getElementById('orderInfo');

  orderInfoDiv.prepend(recentOrderContainer);
  orderInfoDiv.prepend(statusContainer);

  let user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user.uuid) {
    window.location.href = '/index.html';
  }

  let roundsConfig = null;
  let isMatching = false;

  // 获取轮次配置
  async function fetchRoundsConfig() {
    const { data, error } = await supabaseClient
      .from('rounds')
      .select('*')
      .limit(1)
      .single();
    if (error) {
      console.error('获取轮次配置失败', error);
      return;
    }
    roundsConfig = data;
  }

  // 获取最新用户信息
  async function fetchUser() {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('uuid', user.uuid)
      .single();

    if (error || !data) {
      console.error('获取用户信息失败', error);
      return;
    }

    user = data;
    localStorage.setItem('user', JSON.stringify(user));
    renderStatus();
    renderRecentOrder();
  }

  // 渲染 Coins / 轮次 / 按钮 / 倒计时
  function renderStatus() {
    let remainingCooldown = 0;
    if (user.last_round_completed) {
      const now = new Date();
      const last = new Date(user.last_round_completed);
      remainingCooldown = Math.max(
        0,
        Math.ceil((roundsConfig.cooldown_seconds * 1000 - (now - last)) / 1000)
      );
    }

    const roundText = `${user.current_round_count ?? 0}/${roundsConfig.orders_per_round}`;

    statusContainer.innerHTML = `
      <p>Coins: ${user.coins ?? 0}</p>
      <p>轮次: ${roundText}</p>
      ${remainingCooldown > 0 ? `<p>冷却倒计时: ${remainingCooldown}s</p>` : ''}
    `;

    // 按钮状态
    if (remainingCooldown > 0) {
      startBtn.disabled = true;
      startBtn.textContent = '冷却中...';
    } else if (isMatching) {
      startBtn.disabled = true;
      startBtn.textContent = '匹配中...';
    } else {
      startBtn.disabled = user.coins < 30;
      startBtn.textContent = startBtn.dataset.started ? 'GO' : 'START';
    }
  }

  // 渲染最近订单（最新一条）
  async function renderRecentOrder() {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('*, products(name, price, profit, image_url)')
      .eq('user_uuid', user.uuid)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      recentOrderContainer.innerHTML = `<p>最近订单为空</p>`;
      return;
    }

    const p = data.products;
    recentOrderContainer.innerHTML = `
      <h4>最近订单:</h4>
      <p>产品: ${p.name}</p>
      <p>价格: ${p.price}</p>
      <p>利润: ${p.profit}</p>
    `;
  }

  // 匹配产品
  async function matchProduct() {
    if (!roundsConfig) await fetchRoundsConfig();

    // 随机匹配产品
    const { data: products, error } = await supabaseClient
      .from('products')
      .select('*')
      .order('id', { ascending: false }) // Supabase v2 不能直接 random()，这里可调整
      .limit(1);

    if (error || !products || products.length === 0) {
      alert('匹配失败，请重试');
      isMatching = false;
      renderStatus();
      return;
    }

    const product = products[0];

    // 更新用户匹配状态
    const { data: updatedUser } = await supabaseClient
      .from('users')
      .update({
        coins: user.coins - product.price,
        last_matched_product: product,
        matching_started_at: new Date()
      })
      .eq('uuid', user.uuid)
      .select()
      .single();

    user = updatedUser;
    localStorage.setItem('user', JSON.stringify(user));
    isMatching = false;
    renderStatus();
    renderMatchedProduct(product);
  }

  function renderMatchedProduct(product) {
    recentOrderContainer.innerHTML = `
      <h4>匹配到产品:</h4>
      <p>产品: ${product.name}</p>
      <p>价格: ${product.price}</p>
      <p>利润: ${product.profit}</p>
      <img src="${product.image_url}" width="100" />
      <button id="completeBtn">完成</button>
    `;

    const completeBtn = document.getElementById('completeBtn');

    if (user.coins < 0) {
      completeBtn.disabled = true;
      completeBtn.textContent = '金币不足，先充值';
    } else {
      completeBtn.disabled = false;
    }

    completeBtn.addEventListener('click', async () => {
      // 完成订单：增加 Coins 和利润 + 轮次++
      const { data: updatedUser } = await supabaseClient
        .from('users')
        .update({
          coins: user.coins + product.price + product.profit,
          current_round_count: (user.current_round_count ?? 0) + 1,
          last_round_completed: (user.current_round_count + 1) >= roundsConfig.orders_per_round ? new Date() : user.last_round_completed,
          last_matched_product: null,
          matching_started_at: null
        })
        .eq('uuid', user.uuid)
        .select()
        .single();

      // 写订单历史
      await supabaseClient.from('orders').insert({
        user_uuid: user.uuid,
        product_id: product.id,
        price: product.price,
        profit: product.profit
      });

      user = updatedUser;
      localStorage.setItem('user', JSON.stringify(user));
      renderStatus();
      renderRecentOrder();
    });
  }

  // START / GO 按钮点击
  startBtn.addEventListener('click', async () => {
    if (!startBtn.dataset.started) {
      startBtn.dataset.started = true;
    }
    isMatching = true;
    renderStatus();

    await matchProduct();
  });

  // 页面加载
  (async function init() {
    await fetchRoundsConfig();
    await fetchUser();

    // 每秒刷新状态（倒计时 / Coins / 轮次）
    setInterval(fetchUser, 1000);
  })();

})();
