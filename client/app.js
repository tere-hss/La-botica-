/* ─────────────── CONFIG ─────────────── */
const API = 'http://localhost:3001/api';
const socket = io('http://localhost:3001');

/* ─────────────── STATE ─────────────── */
let state = {
  employee: null,
  zones: [],
  activeZone: null,
  categories: [],
  products: [],
  activeCategory: null,
  currentTableId: null,
  currentOrder: null,
  payMethod: 'efectivo',
  divideSelected: [],   // item ids selected to pay in divide modal
  isNight: false,
};

/* ─────────────── HELPERS ─────────────── */
const $ = id => document.getElementById(id);
const fmt = n => (n ?? 0).toFixed(2).replace('.', ',') + ' €';
const elapsed = (created_at) => {
  if (!created_at) return '';
  const diff = Math.floor((Date.now() - new Date(created_at).getTime()) / 60000);
  return diff < 1 ? '<1min' : `${diff}min`;
};

function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  t.style.cursor = 'pointer';
  t.style.pointerEvents = 'auto';
  t.onclick = () => t.remove();
  $('toast-wrap').appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut .2s ease forwards';
    setTimeout(() => t.remove(), 200);
  }, 2800);
}

async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (e) {
    toast(e.message, 'err');
    throw e;
  }
}

/* ─────────────── CLOCK ─────────────── */
function tickClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  $('clock').textContent = `${h}:${m}`;
  const hour = now.getHours();
  state.isNight = hour >= 21 || hour < 6;
  const pf = $('price-flag');
  const sb = $('shift-badge');
  if (state.isNight) {
    pf.className = 'price-flag night'; pf.textContent = 'TARIFA NOCHE';
    sb.textContent = 'NOCHE';
  } else {
    pf.className = 'price-flag day'; pf.textContent = 'TARIFA DÍA';
    sb.textContent = 'DÍA';
  }
}
setInterval(tickClock, 10000);
tickClock();

/* ─────────────── LOGIN ─────────────── */
let pinBuffer = '';
let selectedEmployee = null;

async function initLogin() {
  const employees = await apiFetch('/auth/employees');
  const grid = $('emp-grid');
  grid.innerHTML = '';
  employees.forEach(emp => {
    const btn = document.createElement('button');
    btn.className = 'emp-btn';
    btn.dataset.id = emp.id;
    btn.innerHTML = `
      <div class="emp-avatar" style="background:${emp.color}">${emp.initial}</div>
      <span class="emp-name">${emp.name}</span>
      <span class="emp-role">${emp.role}</span>`;
    btn.onclick = () => selectEmployee(emp);
    grid.appendChild(btn);
  });
  renderPinDots();
}

function selectEmployee(emp) {
  selectedEmployee = emp;
  pinBuffer = '';
  document.querySelectorAll('.emp-btn').forEach(b => b.classList.remove('sel'));
  document.querySelector(`.emp-btn[data-id="${emp.id}"]`)?.classList.add('sel');
  $('login-err').textContent = '';
  renderPinDots();
}

function renderPinDots() {
  const d = $('pin-display');
  d.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement('div');
    dot.className = 'pin-dot' + (i < pinBuffer.length ? ' on' : '');
    d.appendChild(dot);
  }
}

document.querySelectorAll('.pin-key').forEach(key => {
  key.addEventListener('click', () => {
    const k = key.dataset.k;
    if (!selectedEmployee && k !== 'clear') { $('login-err').textContent = 'Selecciona un empleado'; return; }
    if (k === 'clear') { pinBuffer = ''; $('login-err').textContent = ''; }
    else if (k === 'enter') { doLogin(); return; }
    else if (pinBuffer.length < 4) pinBuffer += k;
    renderPinDots();
    if (pinBuffer.length === 4) doLogin();
  });
});

async function doLogin() {
  if (!selectedEmployee) return;
  try {
    const { employee } = await apiFetch('/auth/login', {
      method: 'POST',
      body: { employee_id: selectedEmployee.id, pin: pinBuffer },
    });
    state.employee = employee;
    $('screen-login').style.display = 'none';
    $('app').classList.add('on');
    $('chip-av').textContent = employee.initial;
    $('chip-av').style.background = employee.color;
    $('chip-nm').textContent = employee.name;
    await loadMapa();
    await loadCatalog();
  } catch {
    pinBuffer = '';
    renderPinDots();
    $('login-err').textContent = 'PIN incorrecto';
  }
}

function logout() {
  if (!confirm('¿Cerrar sesión?')) return;
  state.employee = null;
  selectedEmployee = null;
  pinBuffer = '';
  $('app').classList.remove('on');
  $('screen-login').style.display = '';
  $('login-err').textContent = '';
  renderPinDots();
  document.querySelectorAll('.emp-btn').forEach(b => b.classList.remove('sel'));
}

/* ─────────────── VIEWS ─────────────── */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('on'));
  $(`view-${name}`)?.classList.add('on');
  document.querySelector(`.nav-tab[data-view="${name}"]`)?.classList.add('on');
  if (name === 'cocina') loadCocina();
  if (name === 'mapa') loadMapa();
}

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => showView(tab.dataset.view));
});

/* ─────────────── MAPA ─────────────── */
async function loadMapa() {
  const zones = await apiFetch('/tables');
  state.zones = zones;
  const tabsEl = $('zone-tabs');
  tabsEl.innerHTML = '';
  zones.forEach((z, i) => {
    const btn = document.createElement('button');
    btn.className = 'zone-tab' + (i === 0 ? ' on' : '');
    btn.textContent = z.name;
    btn.onclick = () => {
      document.querySelectorAll('.zone-tab').forEach(t => t.classList.remove('on'));
      btn.classList.add('on');
      renderZone(z);
    };
    tabsEl.appendChild(btn);
  });
  if (zones.length > 0) renderZone(zones[0]);
}

function renderZone(zone) {
  state.activeZone = zone;
  const canvas = $('zone-canvas');
  canvas.innerHTML = '';
  zone.tables.forEach(t => {
    const el = document.createElement('div');
    el.className = `mesa ${t.status}`;
    el.style.left = t.x + 'px';
    el.style.top = t.y + 'px';
    el.dataset.id = t.id;
    const pending = t.pending_items > 0;
    el.innerHTML = `
      <div class="m-num">${t.label}</div>
      <div class="m-info">${t.status === 'libre' ? '○ libre' : `${t.pending_items || 0} items`}</div>
      ${t.total > 0 ? `<div class="m-total">${fmt(t.total)}</div>` : ''}
      ${pending ? `<div class="m-alert">!</div>` : ''}
      ${t.opened_at && t.status !== 'libre' ? `<div class="m-time">${elapsed(t.opened_at)}</div>` : ''}
    `;
    el.onclick = () => openTable(t);
    canvas.appendChild(el);
  });
}

async function openTable(table) {
  state.currentTableId = table.id;
  const zoneLabel = state.zones.find(z => z.id === table.zone_id)?.name || '';
  $('cmd-zona-label').textContent = zoneLabel;
  $('cmd-mesa-label').innerHTML = `<small>${zoneLabel}</small>Mesa ${table.label}`;

  // Open or get order
  let order = await apiFetch(`/orders/table/${table.id}`);
  if (!order) {
    order = await apiFetch(`/orders/table/${table.id}`, {
      method: 'POST',
      body: { employee_id: state.employee.id, guests: 1 },
    });
  }
  state.currentOrder = order;
  renderComanda();
  showView('comanda');
}

/* ─────────────── CATALOG ─────────────── */
async function loadCatalog() {
  const [cats, prods] = await Promise.all([
    apiFetch('/categories'),
    apiFetch('/products'),
  ]);
  state.categories = cats;
  state.products = prods;
  renderCats();
  if (cats.length > 0) {
    state.activeCategory = cats[0].id;
    renderProducts();
  }
}

function renderCats() {
  const el = $('cmd-cats');
  el.innerHTML = '';
  state.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cmd-cat' + (cat.id === state.activeCategory ? ' on' : '');
    const count = state.products.filter(p => p.category_id === cat.id).length;
    btn.innerHTML = `<span class="ce">${cat.emoji}</span>${cat.name}<span class="cc">${count}</span>`;
    btn.onclick = () => {
      state.activeCategory = cat.id;
      document.querySelectorAll('.cmd-cat').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      renderProducts();
    };
    el.appendChild(btn);
  });
}

function renderProducts() {
  const grid = $('cmd-grid');
  grid.innerHTML = '';
  const filtered = state.products.filter(p => p.category_id === state.activeCategory);
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="pcard-empty" style="grid-column:1/-1;color:var(--muted);text-align:center;padding:40px">Sin productos</div>';
    return;
  }
  filtered.forEach(p => {
    const card = document.createElement('button');
    card.className = 'pcard';
    card.innerHTML = `
      <div class="demand" style="width:${(p.demand || 0) * 100}%"></div>
      <div class="pe">${p.emoji}</div>
      <div class="pn">${p.name}</div>
      <div class="pp">${fmt(p.price)}</div>`;
    card.onclick = () => addItem(p);
    grid.appendChild(card);
  });
}

/* ─────────────── SEARCH ─────────────── */
const searchInput = $('search-input');
const suggestEl = $('search-suggest');

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
  const q = searchInput.value.toLowerCase().trim();
  if (!q) { suggestEl.classList.add('hidden'); return; }
  const matches = state.products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8);
  if (matches.length === 0) {
    suggestEl.innerHTML = '<div class="ss-none">Sin resultados</div>';
  } else {
    const grouped = {};
    matches.forEach(p => {
      if (!grouped[p.category_name]) grouped[p.category_name] = [];
      grouped[p.category_name].push(p);
    });
    suggestEl.innerHTML = Object.entries(grouped).map(([cat, prods]) =>
      `<div class="ss-cat">${cat}</div>` +
      prods.map(p => `
        <div class="ss-item" data-id="${p.id}">
          <span>${p.emoji} ${p.name}</span>
          <span class="ss-price">${fmt(p.price)}</span>
        </div>`).join('')
    ).join('');
    suggestEl.querySelectorAll('.ss-item').forEach(item => {
      item.onclick = () => {
        const prod = state.products.find(p => p.id === +item.dataset.id);
        if (prod) addItem(prod);
        searchInput.value = '';
        suggestEl.classList.add('hidden');
      };
    });
  }
  suggestEl.classList.remove('hidden');
  }, 80);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.cmd-search')) suggestEl.classList.add('hidden');
});

/* ─────────────── COMANDA ─────────────── */
async function addItem(product) {
  if (!state.currentOrder) return;
  await apiFetch(`/orders/${state.currentOrder.id}/items`, {
    method: 'POST',
    body: { product_id: product.id, quantity: 1 },
  });
  await refreshOrder();
}

async function removeItem(itemId) {
  await apiFetch(`/orders/items/${itemId}`, { method: 'DELETE' });
  await refreshOrder();
}

async function refreshOrder() {
  const order = await apiFetch(`/orders/table/${state.currentTableId}`);
  state.currentOrder = order;
  renderComanda();
}

function renderComanda() {
  const order = state.currentOrder;
  if (!order || !order.items) {
    $('cmd-list').innerHTML = '<div class="cmd-empty"><span class="i">🧾</span>Sin artículos</div>';
    $('cmd-total-val').textContent = '0,00 €';
    $('status-sent').textContent = '';
    $('status-pend').textContent = '';
    $('send-btn').disabled = true;
    $('btn-pedir-cuenta').classList.add('hidden');
    $('clientes-badge').textContent = '👥 —';
    $('panel-comanda-title').textContent = 'Comanda';
    return;
  }

  const items = order.items;
  const sentItems = items.filter(i => ['sent','preparing','ready','delivered'].includes(i.status));
  const pendItems = items.filter(i => i.status === 'pending');
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  $('panel-comanda-title').textContent = `Comanda #${order.id}`;
  $('clientes-badge').textContent = `👥 ${order.guests || 1}`;
  $('cmd-total-val').textContent = fmt(total);
  $('send-btn').disabled = pendItems.length === 0;
  $('btn-pedir-cuenta').classList.toggle('hidden', items.length === 0);

  $('status-sent').textContent = sentItems.length > 0 ? `✓ ${sentItems.length} enviados` : '';
  $('status-pend').textContent = pendItems.length > 0 ? `⏳ ${pendItems.length} pendientes` : '';

  if (items.length === 0) {
    $('cmd-list').innerHTML = '<div class="cmd-empty"><span class="i">🧾</span>Sin artículos</div>';
    return;
  }

  $('cmd-list').innerHTML = items.map(item => {
    const sent = item.status !== 'pending';
    const statusTag = sent ? `<span class="tag">${statusEmoji(item.status)}</span>` : '';
    return `
      <div class="cmd-line ${sent ? 'sent' : 'nuevo'}">
        <span class="q">${item.quantity}×</span>
        <span class="n">${item.emoji || ''} ${item.product_name}${statusTag}</span>
        <span class="pr">${fmt(item.price * item.quantity)}</span>
        ${!sent ? `<button class="x" onclick="removeItem(${item.id})">✕</button>` : ''}
      </div>`;
  }).join('');
}

function statusEmoji(s) {
  return { sent: '📤', preparing: '👨‍🍳', ready: '✅', delivered: '✓' }[s] || s;
}

async function sendToKitchen() {
  if (!state.currentOrder) return;
  const btn = $('send-btn');
  btn.disabled = true;
  btn.textContent = 'ENVIANDO...';
  try {
    await apiFetch(`/orders/${state.currentOrder.id}/send`, { method: 'POST' });
    toast('Enviado a cocina ✓');
    await refreshOrder();
  } finally {
    btn.textContent = 'ENVIAR A COCINA';
  }
}

function changeGuests() {
  const pop = $('guests-pop');
  if (!pop.classList.contains('hidden')) { pop.classList.add('hidden'); return; }
  $('guests-num').textContent = state.currentOrder?.guests || 1;
  pop.classList.remove('hidden');
  document.addEventListener('click', function handler(e) {
    if (!e.target.closest('.guests-pop') && e.target !== $('clientes-badge')) {
      pop.classList.add('hidden');
      document.removeEventListener('click', handler);
    }
  });
}

function adjGuests(delta) {
  const current = parseInt($('guests-num').textContent) || 1;
  $('guests-num').textContent = Math.max(1, Math.min(20, current + delta));
}

function closeGuests() {
  const n = parseInt($('guests-num').textContent) || 1;
  if (state.currentOrder) state.currentOrder.guests = n;
  $('clientes-badge').textContent = `👥 ${n}`;
  $('guests-pop').classList.add('hidden');
}

/* ─────────────── COCINA ─────────────── */
let cocinaInterval = null;

async function loadCocina() {
  const orders = await apiFetch('/orders/kitchen');
  const body = $('cocina-body');
  $('cocina-tick').textContent = `Actualizado ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  if (orders.length === 0) {
    body.innerHTML = '<div class="cocina-empty"><span class="ic">✅</span><span>Todo listo — sin pedidos pendientes</span></div>';
    return;
  }

  const STATUS_ORDER = { sent: 0, preparing: 1, ready: 2 };
  orders.forEach(o => o.items.sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)));

  body.innerHTML = orders.map(order => `
    <div class="kcard">
      <div class="kcard-head">
        <span class="kcard-mesa">Mesa ${order.table_label}</span>
        <span class="kcard-time">Comanda #${order.id}</span>
      </div>
      <div class="kcard-items">
        ${order.items.map(item => `
          <div class="kitem ${item.status}" id="kitem-${item.id}">
            <span class="ke">${item.emoji || '🍽️'}</span>
            <span class="kq">${item.quantity}×</span>
            <div style="flex:1">
              <div class="kn">${item.product_name}</div>
              ${item.notes ? `<div class="knt">${item.notes}</div>` : ''}
            </div>
            <div class="kitem-btns">
              ${item.status === 'sent' ? `<button class="kbtn preparar" onclick="setKitchenStatus(${item.id},'preparing')">Preparar</button>` : ''}
              ${item.status === 'preparing' ? `<button class="kbtn listo" onclick="setKitchenStatus(${item.id},'ready')">Listo ✓</button>` : ''}
              ${item.status === 'ready' ? '<span style="color:var(--success);font-size:11px;font-family:\'DM Mono\',monospace">LISTO ✅</span>' : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

async function setKitchenStatus(itemId, status) {
  await apiFetch(`/orders/items/${itemId}/status`, { method: 'PATCH', body: { status } });
  loadCocina();
}

/* ─────────────── PAGO ─────────────── */
function openPago() {
  if (!state.currentOrder) return;
  const total = state.currentOrder.items?.reduce((s, i) => s + i.price * i.quantity, 0) || 0;
  $('pago-sub').textContent = `Mesa ${state.currentOrder.table_id} · Comanda #${state.currentOrder.id}`;
  $('pay-total-val').textContent = fmt(total);
  selectMethod('efectivo');
  buildQuickCash(total);
  openModal('modal-pago');
}

function buildQuickCash(total) {
  const amounts = [5, 10, 20, 50].filter(a => a >= total);
  if (amounts.length === 0) amounts.push(Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20);
  const first = amounts.slice(0, 3);
  $('quick-cash').innerHTML = first.map(a =>
    `<button onclick="$('efectivo-input').value='${a}';calcCambio()">${a} €</button>`
  ).join('');
}

function selectMethod(method) {
  state.payMethod = method;
  document.querySelectorAll('.pay-m').forEach(m => m.classList.remove('sel'));
  document.querySelector(`.pay-m[data-method="${method}"]`)?.classList.add('sel');
  $('efectivo-row').classList.toggle('on', method === 'efectivo');
  $('cambio-row').classList.remove('on');
  $('efectivo-input').value = '';
}

function calcCambio() {
  const total = parseFloat($('pay-total-val').textContent.replace(',', '.').replace(' €', '')) || 0;
  const paid = parseFloat($('efectivo-input').value) || 0;
  const cambio = paid - total;
  if (cambio > 0) {
    $('cambio-val').textContent = fmt(cambio);
    $('cambio-row').classList.add('on');
  } else {
    $('cambio-row').classList.remove('on');
  }
}

async function confirmPago() {
  if (!state.currentOrder) return;
  const btn = document.querySelector('#modal-pago .pay-confirm');
  btn.disabled = true;
  btn.textContent = 'Procesando...';
  try {
    const total = state.currentOrder.items?.reduce((s, i) => s + i.price * i.quantity, 0) || 0;
    const amountPaid = state.payMethod === 'efectivo' ? parseFloat($('efectivo-input').value) || total : total;
    await apiFetch(`/orders/${state.currentOrder.id}/pay`, {
      method: 'POST',
      body: { method: state.payMethod, amount_paid: amountPaid },
    });
    closeModal('modal-pago');
    toast(`Cobro de ${fmt(total)} completado ✓`);
    state.currentOrder = null;
    await loadMapa();
    showView('mapa');
  } finally {
    btn.disabled = false;
    btn.textContent = 'CONFIRMAR PAGO';
  }
}

/* ─────────────── DIVIDIR ─────────────── */
function openDividir() {
  if (!state.currentOrder?.items?.length) { toast('Sin artículos en la comanda', 'err'); return; }
  state.divideSelected = [];
  renderDivide();
  openModal('modal-dividir');
}

function renderDivide() {
  const items = state.currentOrder.items;
  const pending = items.filter(i => !state.divideSelected.includes(i.id));
  const selected = items.filter(i => state.divideSelected.includes(i.id));
  const selTotal = selected.reduce((s, i) => s + i.price * i.quantity, 0);
  const pendTotal = pending.reduce((s, i) => s + i.price * i.quantity, 0);

  $('dp-pending-total').textContent = fmt(pendTotal);
  $('dp-sel-total').textContent = fmt(selTotal);
  $('divide-total-sv').textContent = fmt(selTotal);

  const renderItems = (list, toSel) => list.length === 0
    ? '<div class="dempty">Sin artículos</div>'
    : list.map(i => `
        <div class="ditem" onclick="toggleDivide(${i.id})">
          <span class="dn">${i.quantity}× ${i.product_name}</span>
          <span class="dpr">${fmt(i.price * i.quantity)}</span>
        </div>`).join('');

  $('divide-pending').innerHTML = renderItems(pending, true);
  $('divide-selected').innerHTML = renderItems(selected, false);
  $('divide-pending').querySelectorAll('.ditem').forEach((el, idx) => {
    el.onclick = () => { state.divideSelected.push(pending[idx].id); renderDivide(); };
  });
  $('divide-selected').querySelectorAll('.ditem').forEach((el, idx) => {
    el.onclick = () => { state.divideSelected = state.divideSelected.filter(id => id !== selected[idx].id); renderDivide(); };
  });
}

async function cobrarDivide() {
  if (state.divideSelected.length === 0) { toast('Selecciona artículos a cobrar', 'err'); return; }
  const btn = document.querySelector('#modal-dividir .pay-confirm');
  btn.disabled = true;
  btn.textContent = 'Procesando...';
  try {
    for (const itemId of state.divideSelected) {
      await apiFetch(`/orders/items/${itemId}/status`, { method: 'PATCH', body: { status: 'delivered' } });
    }
    state.divideSelected = [];
    closeModal('modal-dividir');
    await refreshOrder();
    toast('Parcial cobrado ✓');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Cobrar selección';
  }
}

/* ─────────────── TRASLADO ─────────────── */
function openTraslado() {
  if (!state.currentOrder) return;
  $('traslado-sub').textContent = `Mover comanda #${state.currentOrder.id} a otra mesa`;
  const pick = $('traslado-pick');
  pick.innerHTML = '';
  state.zones.forEach(zone => {
    zone.tables.forEach(t => {
      if (t.id === state.currentTableId) return;
      const btn = document.createElement('button');
      btn.className = 'mesa-pick-btn';
      btn.textContent = t.label;
      btn.disabled = t.status === 'ocupada';
      btn.title = t.status === 'ocupada' ? 'Mesa ocupada' : `Mesa ${t.label} — ${zone.name}`;
      btn.onclick = () => doTraslado(t.id, t.label);
      pick.appendChild(btn);
    });
  });
  openModal('modal-traslado');
}

async function doTraslado(targetId, targetLabel) {
  document.querySelectorAll('.mesa-pick-btn').forEach(b => b.disabled = true);
  try {
    await apiFetch(`/orders/${state.currentOrder.id}/transfer`, {
      method: 'POST',
      body: { target_table_id: targetId },
    });
    closeModal('modal-traslado');
    toast(`Comanda trasladada a Mesa ${targetLabel}`);
    state.currentTableId = targetId;
    const order = await apiFetch(`/orders/table/${targetId}`);
    state.currentOrder = order;
    renderComanda();
    await loadMapa();
  } finally {
    document.querySelectorAll('.mesa-pick-btn').forEach(b => b.disabled = false);
  }
}

/* ─────────────── MODAL HELPERS ─────────────── */
function openModal(id) { $(id).classList.add('on'); }
function closeModal(id) { $(id).classList.remove('on'); }
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('on'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.on').forEach(o => o.classList.remove('on'));
    $('guests-pop')?.classList.add('hidden');
  }
});

/* ─────────────── SOCKET.IO ─────────────── */
socket.on('tables:refresh', () => {
  if ($('view-mapa').classList.contains('on')) loadMapa();
});
socket.on('kitchen:refresh', () => {
  if ($('view-cocina').classList.contains('on')) loadCocina();
});
socket.on('order:updated', ({ order_id }) => {
  if (state.currentOrder?.id === order_id) refreshOrder();
});

/* ─────────────── AUTO-REFRESH COCINA ─────────────── */
setInterval(() => {
  if (!document.hidden && $('view-cocina').classList.contains('on')) loadCocina();
}, 15000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && $('view-cocina').classList.contains('on')) loadCocina();
});

/* ─────────────── BOOT ─────────────── */
initLogin();
