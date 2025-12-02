// Contratos: listar y gestionar contratos del usuario

const contractsList = document.getElementById('contractsList');
const contractsMessage = document.getElementById('contractsMessage');
const tabBtns = document.querySelectorAll('.tab-btn');

let currentRole = 'client';

function showMessage(text) {
  if (!contractsMessage) return;
  contractsMessage.textContent = text;
  contractsMessage.style.display = 'block';
}

function hideMessage() {
  if (contractsMessage) contractsMessage.style.display = 'none';
}

function getStatusInfo(status) {
  const statusMap = {
    pending: { label: 'Pendiente', color: 'var(--warning)', icon: 'fa-clock' },
    paid: { label: 'Pagado', color: 'var(--info)', icon: 'fa-credit-card' },
    accepted: { label: 'Aceptado', color: 'var(--info)', icon: 'fa-check-circle' },
    rejected: { label: 'Rechazado', color: 'var(--danger)', icon: 'fa-times-circle' },
    in_progress: { label: 'En Progreso', color: 'var(--primary)', icon: 'fa-spinner' },
    delivered: { label: 'Entregado', color: 'var(--success)', icon: 'fa-box' },
    completed: { label: 'Completado', color: 'var(--success)', icon: 'fa-check-double' },
    disputed: { label: 'En Disputa', color: 'var(--danger)', icon: 'fa-exclamation-triangle' },
    cancelled: { label: 'Cancelado', color: 'var(--text-tertiary)', icon: 'fa-ban' }
  };
  return statusMap[status] || { label: status, color: 'var(--text-secondary)', icon: 'fa-question' };
}

function renderContractCard(contract) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginBottom = '16px';

  const statusInfo = getStatusInfo(contract.status);
  const priceQZ = ((contract.total_amount_qz_halves || contract.service_price_qz_halves || contract.price_qz_halves || 0) / 2).toFixed(1);

  const otherParty = currentRole === 'client' 
    ? { name: contract.provider_name || 'Proveedor', email: contract.provider_email }
    : { name: contract.client_name || 'Cliente', email: contract.client_email };

  const thumb = contract.service_image
    ? `<img src="${contract.service_image}" alt="Servicio" style="width:64px;height:64px;border-radius:var(--radius-md);object-fit:cover;" />`
    : `<div style="width:64px;height:64px;background:var(--bg-tertiary);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;">
         <i class="fas fa-briefcase" style="color:var(--text-tertiary);"></i>
       </div>`;

  card.innerHTML = `
    <div class="card-body">
      <div style="display:flex;gap:16px;align-items:start;margin-bottom:16px;">
        ${thumb}
        <div style="flex:1;">
          <h3 style="font-size:16px;font-weight:600;margin-bottom:4px;">${contract.service_title || 'Sin título'}</h3>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span class="helper" style="text-transform:capitalize;">
              <i class="fas fa-tag"></i> ${contract.service_category || '-'}
            </span>
            <span style="font-weight:600;color:${statusInfo.color};">
              <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
            </span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:20px;font-weight:700;color:var(--primary);">${priceQZ} QZ</div>
          <div class="helper">${new Date(contract.created_at).toLocaleDateString()}</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);">
        <i class="fas fa-user-circle" style="font-size:24px;color:var(--text-tertiary);"></i>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:14px;">${otherParty.name}</div>
          <div class="helper" style="font-size:12px;">${otherParty.email || ''}</div>
        </div>
        <button class="btn-secondary" style="padding:6px 12px;font-size:13px;" data-view-profile="${currentRole === 'client' ? contract.provider_id : contract.client_id}">
          <i class="fas fa-user"></i> Ver Perfil
        </button>
      </div>

      <div class="form-actions" style="justify-content:flex-start;">
        ${getActionButtons(contract)}
      </div>
    </div>
  `;

  // Event listeners para acciones
  const acceptBtn = card.querySelector('[data-action="accept"]');
  const rejectBtn = card.querySelector('[data-action="reject"]');
  const payBtn = card.querySelector('[data-action="pay"]');
  const startBtn = card.querySelector('[data-action="start"]');
  const deliverBtn = card.querySelector('[data-action="deliver"]');
  const completeBtn = card.querySelector('[data-action="complete"]');
  const cancelBtn = card.querySelector('[data-action="cancel"]');

  if (acceptBtn) acceptBtn.addEventListener('click', () => updateStatus(contract.id, 'accepted'));
  if (rejectBtn) rejectBtn.addEventListener('click', () => updateStatus(contract.id, 'rejected'));
  if (payBtn) payBtn.addEventListener('click', () => updateStatus(contract.id, 'paid'));
  if (startBtn) startBtn.addEventListener('click', () => updateStatus(contract.id, 'in_progress'));
  if (deliverBtn) deliverBtn.addEventListener('click', () => updateStatus(contract.id, 'delivered'));
  if (completeBtn) completeBtn.addEventListener('click', () => updateStatus(contract.id, 'completed'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => updateStatus(contract.id, 'cancelled'));

  // Botón ver perfil
  const viewProfileBtn = card.querySelector('[data-view-profile]');
  if (viewProfileBtn) {
    viewProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const userId = viewProfileBtn.dataset.viewProfile;
      if (userId) {
        window.location.href = `/ver-perfil?id=${userId}`;
      }
    });
  }

  return card;
}

function getActionButtons(contract) {
  const { status } = contract;
  let buttons = '';

  if (currentRole === 'provider') {
    if (status === 'pending' || status === 'paid') {
      buttons = `
        <button class="btn-primary" data-action="accept"><i class="fas fa-check"></i> Aceptar</button>
        <button class="btn-danger" data-action="reject"><i class="fas fa-times"></i> Rechazar</button>
      `;
    } else if (status === 'accepted') {
      buttons = `<button class="btn-primary" data-action="start"><i class="fas fa-play"></i> Iniciar Trabajo</button>`;
    } else if (status === 'in_progress') {
      buttons = `<button class="btn-success" data-action="deliver"><i class="fas fa-box"></i> Marcar Entregado</button>`;
    }
  }

  if (currentRole === 'client') {
    if (status === 'pending') {
      buttons = `<button class="btn-primary" data-action="pay"><i class="fas fa-credit-card"></i> Pagar</button>`;
    }
    if (status === 'delivered' || status === 'in_progress') {
      buttons = `<button class="btn-success" data-action="complete"><i class="fas fa-check-double"></i> Marcar Completado</button>`;
    }
    if (['pending', 'paid', 'accepted', 'in_progress'].includes(status)) {
      buttons += `<button class="btn-secondary" data-action="cancel"><i class="fas fa-ban"></i> Cancelar</button>`;
    }
  }

  return buttons || '<span class="helper">Sin acciones disponibles</span>';
}

async function updateStatus(contractId, newStatus) {
  try {
    const res = await fetch(`/contracts/${contractId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) {
      const error = await res.json();
      let message = 'Error al actualizar estado';
      
      // Mensajes específicos según código de error
      if (res.status === 400) {
        message = error.error || 'Acción no permitida en el estado actual del contrato';
      } else if (res.status === 403) {
        message = 'No tienes permisos para realizar esta acción';
      } else if (res.status === 404) {
        message = 'Contrato no encontrado';
      } else if (res.status === 500) {
        message = 'Error del servidor. Intenta nuevamente';
      }
      
      throw new Error(message);
    }

    showMessage('Estado actualizado correctamente.');
    fetchContracts();
  } catch (err) {
    alert(err.message || 'No se pudo actualizar el contrato.');
  }
}

async function fetchContracts() {
  if (!contractsList) return;
  contractsList.innerHTML = '';
  hideMessage();

  try {
    const res = await fetch(`/contracts?role=${currentRole}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!res.ok) throw new Error('Error al obtener contratos');
    const contracts = await res.json();

    if (contracts.length === 0) {
      showMessage(`No tienes contratos como ${currentRole === 'client' ? 'cliente' : 'proveedor'}.`);
      return;
    }

    const frag = document.createDocumentFragment();
    contracts.forEach(c => frag.appendChild(renderContractCard(c)));
    contractsList.appendChild(frag);
  } catch (err) {
    showMessage('No se pudieron cargar los contratos.');
  }
}

// Tabs
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRole = btn.dataset.role;
    fetchContracts();
  });
});

// Inicializar
fetchContracts();

// Auto-refresh cada 30 segundos
let refreshInterval;
function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    fetchContracts();
  }, 30000); // 30 segundos
}

function stopAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
}

// Iniciar auto-refresh
startAutoRefresh();

// Detener cuando se oculta la página
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
  }
});
