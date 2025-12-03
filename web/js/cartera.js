import { Utils } from './utils.js';
import { API } from './api.js';

const $ = (id) => document.getElementById(id);

const EX_RATE = Number(window.EXCHANGE_RATE_COP_PER_QZ || 10000);

function fmtCOP(n) {
  return (n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

async function loadBalance() {
  try {
    const data = await API.get('/wallet/balance');
    $('balanceQZ').textContent = `${(data.balance_qz || 0).toFixed(1)} QZ`;
    // Calcular COP a partir de QZ con la tasa de cambio
    const copAmount = (data.balance_qz || 0) * EX_RATE;
    $('balanceCOP').textContent = fmtCOP(copAmount);
    $('exchangeRate').textContent = `1 QZ = ${fmtCOP(EX_RATE)}`;
  } catch {
    $('balanceQZ').textContent = '—';
    $('balanceCOP').textContent = '—';
  }
}

function renderTxItem(tx) {
  const qz = tx.amount_qz_halves ? (Number(tx.amount_qz_halves) / 2).toFixed(1) + ' QZ' : '';
  const cop = tx.amount_cop_cents ? fmtCOP(tx.amount_cop_cents / 100) : '';
  const amount = qz || cop || '';
  const iconMap = { purchase: 'fa-cart-plus', topup: 'fa-plus-circle', payment: 'fa-credit-card', refund: 'fa-rotate-left', transfer: 'fa-arrow-right-arrow-left' };
  const icon = iconMap[tx.type] || 'fa-receipt';
  const el = document.createElement('div');
  el.className = 'list-item';
  el.innerHTML = `
    <div class="list-item-body">
      <div>
        <div style="font-weight:600;"><i class="fas ${icon}"></i> ${tx.type}</div>
        <div class="helper" style="font-size:12px;">${new Date(tx.created_at).toLocaleString()}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;">${amount}</div>
        <div class="helper" style="text-transform:capitalize;">${tx.status}</div>
      </div>
    </div>`;
  return el;
}

async function loadTransactions() {
  try {
    const txs = await API.get('/wallet/transactions?limit=20');
    const list = $('txList');
    list.innerHTML = '';
    if (!txs || txs.length === 0) {
      $('txEmpty').style.display = 'block';
      return;
    }
    $('txEmpty').style.display = 'none';
    const frag = document.createDocumentFragment();
    txs.forEach(tx => frag.appendChild(renderTxItem(tx)));
    list.appendChild(frag);
  } catch {
    $('txEmpty').style.display = 'block';
  }
}

function updateTopupCost() {
  const qz = Number($('topupAmount').value || 0);
  const cop = qz * EX_RATE;
  $('topupCost').textContent = fmtCOP(cop);
}

async function handleTopup() {
  const btn = $('topupBtn');
  const msg = $('topupMsg');
  const input = $('topupAmount');
  const qz = Number(input.value || 0);
  if (!qz || qz <= 0) return;
  btn.disabled = true;
  msg.textContent = 'Creando transacción...';
  try {
    const p = await API.post('/payments/purchase', { qz_amount: qz });
    msg.textContent = 'Confirmando pago (simulado)...';
    await API.post('/payments/mock-confirm', { payment_reference: p.payment_reference });
    msg.textContent = 'Recarga realizada';
    // Limpiar el campo y resetear el costo
    input.value = '1';
    updateTopupCost();
    await loadBalance();
    await loadTransactions();
    // Limpiar mensaje después de 2 segundos
    setTimeout(() => { msg.textContent = ''; }, 2000);
  } catch (e) {
    console.error(e);
    msg.textContent = 'No se pudo realizar la recarga';
  } finally {
    btn.disabled = false;
  }
}

function init() {
  $('topupAmount').addEventListener('input', updateTopupCost);
  $('topupBtn').addEventListener('click', handleTopup);
  updateTopupCost();
  loadBalance();
  loadTransactions();
}

document.addEventListener('DOMContentLoaded', init);
