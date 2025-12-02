// Buscar Servicios: obtiene servicios activos y permite filtrar

const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');
const resultsMessage = document.getElementById('resultsMessage');

let allServices = [];

function showMessage(text) {
  if (!resultsMessage) return;
  resultsMessage.textContent = text;
  resultsMessage.style.display = 'block';
}

function hideMessage() {
  if (resultsMessage) resultsMessage.style.display = 'none';
}

async function renderServiceCard(svc) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cursor = 'pointer';
  card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-4px)';
    card.style.boxShadow = 'var(--shadow-md)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = 'var(--shadow-sm)';
  });

  const thumb = svc.image_url
    ? `<img src="${svc.image_url}" alt="Imagen" style="width:100%;height:160px;object-fit:cover;border-radius:var(--radius-md) var(--radius-md) 0 0;" />`
    : `<div style="width:100%;height:160px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;border-radius:var(--radius-md) var(--radius-md) 0 0;">
         <i class="fas fa-image fa-3x" style="color:var(--text-tertiary);"></i>
       </div>`;

  const halves = Number(svc.price_qz_halves ?? 0);
  const priceQZ = (halves / 2).toFixed(1);

  // Obtener información del proveedor
  let providerName = 'Proveedor';
  let providerAvatar = null;
  try {
    const res = await fetch(`/users/${svc.user_id}`);
    if (res.ok) {
      const user = await res.json();
      providerName = user.full_name || 'Proveedor';
      providerAvatar = user.avatar;
    }
  } catch (err) {
    console.error('Error loading provider:', err);
  }

  const avatarUrl = providerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(providerName)}&background=6366f1&color=fff`;

  card.innerHTML = `
    ${thumb}
    <div class="card-body">
      <h3 class="card-title" style="font-size: 16px; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
        ${svc.title || 'Sin título'}
      </h3>
      <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span class="helper" style="text-transform: capitalize;">${svc.category || '-'}</span>
        <span style="font-size: 18px; font-weight: 700; color: var(--primary);">${priceQZ} QZ</span>
      </div>
      <p class="helper" style="margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
        ${svc.description || ''}
      </p>
      <div style="display:flex; align-items:center; gap: 8px; color: var(--text-tertiary); font-size: 13px; margin-bottom: 8px;">
        <i class="fas fa-clock"></i>
        <span>${svc.delivery_time || '-'}</span>
      </div>
      <div style="display:flex; align-items:center; gap: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
        <img src="${avatarUrl}" alt="${providerName}" style="width:24px;height:24px;border-radius:50%;" />
        <span class="provider-link" data-user-id="${svc.user_id}" style="font-size: 13px; color: var(--primary); cursor: pointer; text-decoration: none; transition: opacity 0.2s;">
          ${providerName}
        </span>
      </div>
    </div>
  `;

  // Evento para ver detalles del servicio
  card.addEventListener('click', (e) => {
    // Si se hizo clic en el enlace del proveedor, no redirigir al servicio
    if (e.target.closest('.provider-link')) return;
    window.location.href = `/detalle-servicio?id=${svc.id}`;
  });

  // Evento para ver perfil del proveedor
  const providerLink = card.querySelector('.provider-link');
  if (providerLink) {
    providerLink.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = `/ver-perfil?id=${svc.user_id}`;
    });
    providerLink.addEventListener('mouseenter', () => {
      providerLink.style.opacity = '0.8';
    });
    providerLink.addEventListener('mouseleave', () => {
      providerLink.style.opacity = '1';
    });
  }

  return card;
}

async function filterAndRender() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  let filtered = allServices.filter(svc => svc.status === 'active');

  if (category) {
    filtered = filtered.filter(svc => svc.category === category);
  }

  if (query) {
    filtered = filtered.filter(svc => {
      const titleMatch = (svc.title || '').toLowerCase().includes(query);
      const descMatch = (svc.description || '').toLowerCase().includes(query);
      return titleMatch || descMatch;
    });
  }

  resultsGrid.innerHTML = '';
  hideMessage();

  if (filtered.length === 0) {
    showMessage('No se encontraron servicios con esos criterios.');
    return;
  }

  // Renderizar tarjetas de forma asíncrona
  for (const svc of filtered) {
    const card = await renderServiceCard(svc);
    resultsGrid.appendChild(card);
  }
}

async function fetchServices() {
  try {
    const res = await fetch('/services', { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Error al obtener servicios');
    const data = await res.json();
    
    // Validar estructura de respuesta
    if (!data || typeof data !== 'object') {
      throw new Error('Respuesta inválida del servidor');
    }
    
    allServices = Array.isArray(data) ? data : [];
    filterAndRender();
  } catch (err) {
    showMessage('No se pudieron cargar los servicios.');
  }
}

// Inicializar
fetchServices();

if (searchBtn) searchBtn.addEventListener('click', filterAndRender);
if (searchInput) {
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') filterAndRender();
  });
}
if (categoryFilter) categoryFilter.addEventListener('change', filterAndRender);
