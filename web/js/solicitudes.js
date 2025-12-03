import { API } from './api.js';

const requestsList = document.getElementById('requestsList');
const requestsMessage = document.getElementById('requestsMessage');
const tabBtns = document.querySelectorAll('.tab-btn');
let currentRole = 'client';

function showMessage(text) {
  if (!requestsMessage) return;
  requestsMessage.textContent = text;
  requestsMessage.style.display = 'block';
}
function hideMessage() { if (requestsMessage) requestsMessage.style.display = 'none'; }

function renderRequestCard(sr) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginBottom = '16px';
  card.dataset.requestId = String(sr.id);
  const priceQZ = ((sr.negotiated_price_qz_halves || sr.proposed_price_qz_halves || 0) / 2).toFixed(1);
  const statusLabel = {
    pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada', negotiating: 'En negociación', completed: 'Completada', cancelled: 'Cancelada'
  }[sr.status] || sr.status;

  const otherParty = currentRole === 'client' ? { name: sr.provider_name } : { name: sr.client_name };
  card.innerHTML = `
    <div class="card-body">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <div>
          <h3 style="font-size:16px;font-weight:600;margin-bottom:4px;">${sr.title || 'Solicitud'}</h3>
          <div class="helper">${otherParty.name || ''} • ${statusLabel}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px;font-weight:700;color:var(--primary);">${priceQZ} QZ</div>
          <div class="helper">${new Date(sr.created_at).toLocaleDateString()}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        ${getActionButtons(sr)}
      </div>
    </div>
  `;
  return card;
}

function getActionButtons(sr) {
  const s = sr.status;
  let btns = '';
  if (currentRole === 'provider') {
    if (s === 'pending' || s === 'negotiating') {
      btns = `
        <button class="btn-primary" data-action="accept">Aceptar</button>
        <button class="btn-danger" data-action="reject">Rechazar</button>
        <button class="btn-secondary" data-action="counter">Contraoferta</button>
      `;
    }
  }
  if (currentRole === 'client') {
    if (s !== 'completed') {
      btns = `
        <button class="btn-secondary" data-action="negotiate">Negociar</button>
        <button class="btn-default" data-action="cancel">Cancelar</button>
      `;
    }
  }
  return btns || '<span class="helper">Sin acciones disponibles</span>';
}

async function fetchRequests() {
  if (!requestsList) return;
  requestsList.innerHTML = '';
  hideMessage();
  try {
    const list = await API.get(`/service-requests?role=${currentRole}`);
    if (!list.length) { showMessage(`No tienes solicitudes como ${currentRole === 'client' ? 'cliente' : 'proveedor'}.`); return; }
    const frag = document.createDocumentFragment();
    list.forEach(sr => frag.appendChild(renderRequestCard(sr)));
    requestsList.appendChild(frag);
  } catch (e) {
    showMessage('No se pudieron cargar las solicitudes.');
  }
}

// Delegación de eventos
if (requestsList) {
  requestsList.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    const card = target.closest('.card');
    const id = card?.dataset.requestId;
    if (!id) return;

    const action = target.getAttribute('data-action');
    try {
      if (action === 'accept') {
        const updated = await API.patch(`/service-requests/${id}`, { status: 'accepted' });
        alert('Solicitud aceptada.');
        fetchRequests();
      } else if (action === 'reject') {
        const reason = prompt('Motivo de rechazo (opcional):') || '';
        await API.patch(`/service-requests/${id}`, { status: 'rejected', rejection_reason: reason });
        alert('Solicitud rechazada.');
        fetchRequests();
      } else if (action === 'counter') {
        const price = prompt('Precio propuesto (QZ):');
        if (!price) return;
        const halves = Math.round(Number(price) * 2);
        await API.patch(`/service-requests/${id}`, { status: 'negotiating', negotiated_price_qz_halves: halves, counter_offer_details: `Propuesta: ${price} QZ` });
        alert('Contraoferta enviada.');
        fetchRequests();
      } else if (action === 'negotiate') {
        const price = prompt('Precio deseado (QZ):');
        if (!price) return;
        const halves = Math.round(Number(price) * 2);
        await API.patch(`/service-requests/${id}`, { status: 'negotiating', negotiated_price_qz_halves: halves });
        alert('Solicitud actualizada.');
        fetchRequests();
      } else if (action === 'cancel') {
        await API.patch(`/service-requests/${id}`, { status: 'cancelled' });
        alert('Solicitud cancelada.');
        fetchRequests();
      }
    } catch (err) {
      alert(err.message || 'Acción no disponible');
    }
  });
}

// Tabs
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRole = btn.dataset.role === 'provider' ? 'provider' : 'client';
    fetchRequests();
  });
});

fetchRequests();
