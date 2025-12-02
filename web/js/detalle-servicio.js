// Detalle Servicio: obtiene y muestra toda la info de un servicio

const detailContainer = document.getElementById('serviceDetail');
const detailMessage = document.getElementById('detailMessage');
const backBtn = document.getElementById('backBtn');

function showMessage(text) {
  if (!detailMessage) return;
  detailMessage.textContent = text;
  detailMessage.style.display = 'block';
}

function hideMessage() {
  if (detailMessage) detailMessage.style.display = 'none';
}

function renderServiceDetail(svc) {
  if (!detailContainer) return;

  const halves = Number(svc.price_qz_halves ?? 0);
  const priceQZ = (halves / 2).toFixed(1);

  const imageSection = svc.image_url
    ? `<img src="${svc.image_url}" alt="Imagen del servicio" style="width:100%;max-height:400px;object-fit:cover;border-radius:var(--radius-lg);margin-bottom:24px;" />`
    : `<div style="width:100%;height:300px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;border-radius:var(--radius-lg);margin-bottom:24px;">
         <i class="fas fa-image fa-4x" style="color:var(--text-tertiary);"></i>
       </div>`;

  detailContainer.innerHTML = `
    <div class="card">
      <div class="card-body">
        ${imageSection}
        
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px;flex-wrap:wrap;gap:16px;">
          <div style="flex:1;">
            <h1 style="font-size:28px;font-weight:700;margin-bottom:8px;">${svc.title || 'Sin título'}</h1>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <span class="helper" style="text-transform:capitalize;background:var(--bg-secondary);padding:4px 10px;border-radius:8px;">
                <i class="fas fa-tag"></i> ${svc.category || '-'}
              </span>
              <span class="helper">
                <i class="fas fa-clock"></i> ${svc.delivery_time || '-'}
              </span>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:32px;font-weight:700;color:var(--primary);margin-bottom:8px;">${priceQZ} QZ</div>
            <button class="btn-primary" id="contractBtn" style="width:100%;min-width:180px;">
              <i class="fas fa-handshake"></i> Contratar Servicio
            </button>
          </div>
        </div>

        <hr style="border:none;border-top:1px solid var(--border);margin:24px 0;" />

        <div style="margin-bottom:24px;">
          <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;">
            <i class="fas fa-align-left" style="color:var(--primary);"></i> Descripción
          </h3>
          <p style="line-height:1.7;color:var(--text-secondary);white-space:pre-wrap;">${svc.description || 'Sin descripción'}</p>
        </div>

        ${svc.requirements ? `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;">
            <i class="fas fa-list-check" style="color:var(--primary);"></i> Requisitos del cliente
          </h3>
          <p style="line-height:1.7;color:var(--text-secondary);white-space:pre-wrap;">${svc.requirements}</p>
        </div>
        ` : ''}

        <hr style="border:none;border-top:1px solid var(--border);margin:24px 0;" />

        <div id="providerSection">
          <h3 style="font-size:18px;font-weight:600;margin-bottom:12px;">
            <i class="fas fa-user-tie" style="color:var(--primary);"></i> Proveedor
          </h3>
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="https://ui-avatars.com/api/?name=Proveedor&background=6366f1&color=fff" alt="Proveedor" id="providerAvatar" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--border);" />
            <div style="flex:1;">
              <div style="font-weight:600;" id="providerName">Cargando...</div>
              <div class="helper" id="providerType">-</div>
            </div>
            <button class="btn-secondary" id="viewProviderBtn" style="display:none;">
              <i class="fas fa-user"></i> Ver Perfil
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Cargar información del proveedor
  loadProviderInfo(svc.user_id);

  const contractBtn = document.getElementById('contractBtn');
  if (contractBtn) {
    contractBtn.addEventListener('click', async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          alert('Debes iniciar sesión para contratar servicios.');
          window.location.href = '/vistas/login.html';
          return;
        }

        const res = await fetch('/contracts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ service_id: svc.id })
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Error al crear contrato');
        }

        alert('Contrato creado exitosamente. El proveedor será notificado.');
        window.location.href = '/vistas/contratos.html';
      } catch (err) {
        let message = 'No se pudo crear el contrato.';
        
        if (err.message.includes('already have an active contract')) {
          message = 'Ya tienes un contrato activo para este servicio.';
        } else if (err.message.includes('Cannot contract your own service')) {
          message = 'No puedes contratar tu propio servicio.';
        } else if (err.message.includes('not active')) {
          message = 'Este servicio ya no está disponible.';
        } else if (err.message) {
          message = err.message;
        }
        
        alert(message);
      }
    });
  }
}

async function loadProviderInfo(userId) {
  try {
    const res = await fetch(`/users/${userId}`);
    if (!res.ok) throw new Error('Provider not found');
    const user = await res.json();

    const providerAvatar = document.getElementById('providerAvatar');
    const providerName = document.getElementById('providerName');
    const providerType = document.getElementById('providerType');
    const viewProviderBtn = document.getElementById('viewProviderBtn');

    if (providerAvatar) {
      const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'Proveedor')}&background=6366f1&color=fff`;
      providerAvatar.src = avatarUrl;
      providerAvatar.alt = user.full_name || 'Proveedor';
    }

    if (providerName) {
      providerName.textContent = user.full_name || 'Proveedor';
    }

    if (providerType) {
      const typeMap = {
        provider: 'Proveedor de Servicios',
        consumer: 'Cliente',
        both: 'Proveedor y Cliente'
      };
      providerType.textContent = typeMap[user.user_type] || user.user_type;
    }

    if (viewProviderBtn) {
      viewProviderBtn.style.display = 'inline-flex';
      viewProviderBtn.addEventListener('click', () => {
        window.location.href = `/ver-perfil?id=${userId}`;
      });
    }
  } catch (err) {
    console.error('Error loading provider info:', err);
  }
}

async function fetchServiceDetail(id) {
  if (!id) {
    showMessage('No se especificó ID de servicio.');
    return;
  }

  try {
    const res = await fetch(`/services/${id}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Servicio no encontrado');
    const svc = await res.json();
    hideMessage();
    renderServiceDetail(svc);
  } catch (err) {
    showMessage('No se pudo cargar el servicio. Verifica que existe y está activo.');
  }
}

// Inicializar
const urlParams = new URLSearchParams(window.location.search);
const serviceId = urlParams.get('id');
fetchServiceDetail(serviceId);

// Back button
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.history.back();
  });
}
