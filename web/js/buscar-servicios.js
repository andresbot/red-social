// Buscar Servicios: obtiene servicios activos y permite filtrar con paginación
import { CONFIG } from './config.js';

const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const priceMinFilter = document.getElementById('priceMinFilter');
const priceMaxFilter = document.getElementById('priceMaxFilter');
const ratingFilter = document.getElementById('ratingFilter');
const cityFilter = document.getElementById('cityFilter');
const sortByFilter = document.getElementById('sortByFilter');
const sortOrderFilter = document.getElementById('sortOrderFilter');
const searchBtn = document.getElementById('searchBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const resultsGrid = document.getElementById('resultsGrid');
const resultsMessage = document.getElementById('resultsMessage');
const resultsInfo = document.getElementById('resultsInfo');
const paginationControls = document.getElementById('paginationControls');

// Estado de búsqueda y paginación
let currentPage = 1;
const itemsPerPage = 20;
let totalResults = 0;
let searchTimeout = null;

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

  // Obtener rating promedio del servicio
  let ratingAvg = null;
  let ratingCount = null;
  try {
    const rres = await fetch(`${CONFIG.API_BASE_URL}/ratings/service/${svc.id}?limit=0`);
    if (rres.ok) {
      const rdata = await rres.json();
      ratingAvg = rdata.avg ? Number(rdata.avg.toFixed(1)) : null;
      ratingCount = rdata.total ?? null;
    }
  } catch {}

  // Obtener información del proveedor
  let providerName = 'Proveedor';
  let providerAvatar = null;
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/users/${svc.user_id}`);
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
      ${ratingAvg !== null ? `<div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
        <i class="fas fa-star" style="color:#f59e0b;"></i>
        <span style="font-size: 14px; color: var(--text-secondary);">${ratingAvg} (${ratingCount} reseñas)</span>
      </div>` : ''}
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
    window.location.href = `/vistas/detalle-servicio.html?id=${svc.id}`;
  });

  // Evento para ver perfil del proveedor
  const providerLink = card.querySelector('.provider-link');
  if (providerLink) {
    providerLink.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = `/vistas/ver-perfil.html?id=${svc.user_id}`;
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

// Construir query params desde los filtros
function buildQueryParams(page = 1) {
  const params = new URLSearchParams();
  
  const search = searchInput.value.trim();
  if (search) params.append('search', search);
  
  const category = categoryFilter.value;
  if (category) params.append('category', category);
  
  const priceMin = priceMinFilter.value.trim();
  if (priceMin) params.append('priceMin', priceMin);
  
  const priceMax = priceMaxFilter.value.trim();
  if (priceMax) params.append('priceMax', priceMax);
  
  const minRating = ratingFilter.value;
  if (minRating) params.append('minRating', minRating);
  
  const city = cityFilter.value.trim();
  if (city) params.append('city', city);
  
  const sortBy = sortByFilter.value;
  if (sortBy) params.append('sortBy', sortBy);
  
  const sortOrder = sortOrderFilter.value;
  if (sortOrder) params.append('sortOrder', sortOrder);
  
  params.append('limit', itemsPerPage.toString());
  params.append('offset', ((page - 1) * itemsPerPage).toString());
  
  return params.toString();
}

// Renderizar info de resultados
function renderResultsInfo() {
  if (!resultsInfo) return;
  
  if (totalResults === 0) {
    resultsInfo.textContent = 'No se encontraron resultados';
    return;
  }
  
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalResults);
  resultsInfo.textContent = `Mostrando ${start}-${end} de ${totalResults} servicios`;
}

// Renderizar controles de paginación
function renderPagination() {
  if (!paginationControls) return;
  
  paginationControls.innerHTML = '';
  
  const totalPages = Math.ceil(totalResults / itemsPerPage);
  if (totalPages <= 1) return;
  
  // Botón anterior
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn-secondary';
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevBtn.disabled = currentPage === 1;
  prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1';
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchServices();
    }
  });
  paginationControls.appendChild(prevBtn);
  
  // Info de página
  const pageInfo = document.createElement('span');
  pageInfo.style.fontSize = '14px';
  pageInfo.style.color = 'var(--text-secondary)';
  pageInfo.style.padding = '0 12px';
  pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  paginationControls.appendChild(pageInfo);
  
  // Botón siguiente
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn-secondary';
  nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.style.opacity = currentPage === totalPages ? '0.5' : '1';
  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      fetchServices();
    }
  });
  paginationControls.appendChild(nextBtn);
}

// Limpiar filtros
function clearFilters() {
  searchInput.value = '';
  categoryFilter.value = '';
  priceMinFilter.value = '';
  priceMaxFilter.value = '';
  ratingFilter.value = '';
  cityFilter.value = '';
  sortByFilter.value = 'created_at';
  sortOrderFilter.value = 'DESC';
  currentPage = 1;
  fetchServices();
}

// Buscar con los filtros actuales
function searchWithFilters() {
  currentPage = 1; // Reset a página 1 al aplicar nuevos filtros
  fetchServices();
}

// Buscar con debounce (para inputs de texto)
function searchWithDebounce() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchWithFilters();
  }, 500);
}

async function fetchServices() {
  try {
    const queryString = buildQueryParams(currentPage);
    const res = await fetch(`${CONFIG.API_BASE_URL}/services?${queryString}`,{ 
      headers: { 'Accept': 'application/json' } 
    });
    
    if (!res.ok) throw new Error('Error al obtener servicios');
    const data = await res.json();
    
    // Validar estructura de respuesta
    if (!data || typeof data !== 'object') {
      throw new Error('Respuesta inválida del servidor');
    }
    
    // Manejar respuesta nueva con paginación
    const services = data.services || data;
    totalResults = data.total || (Array.isArray(services) ? services.length : 0);
    
    resultsGrid.innerHTML = '';
    hideMessage();
    
    if (!Array.isArray(services) || services.length === 0) {
      showMessage('No se encontraron servicios con esos criterios.');
      renderResultsInfo();
      renderPagination();
      return;
    }
    
    // Renderizar tarjetas de forma asíncrona
    for (const svc of services) {
      const card = await renderServiceCard(svc);
      resultsGrid.appendChild(card);
    }
    
    renderResultsInfo();
    renderPagination();
    
    // Scroll suave al inicio de resultados al cambiar de página
    if (currentPage > 1) {
      resultsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    console.error('Error fetching services:', err);
    showMessage('No se pudieron cargar los servicios.');
    totalResults = 0;
    renderResultsInfo();
    renderPagination();
  }
}

// Inicializar
fetchServices();

// Event listeners
if (searchBtn) searchBtn.addEventListener('click', searchWithFilters);
if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);

// Búsqueda con debounce para inputs de texto
if (searchInput) {
  searchInput.addEventListener('input', searchWithDebounce);
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') searchWithFilters();
  });
}
if (cityFilter) cityFilter.addEventListener('input', searchWithDebounce);
if (priceMinFilter) priceMinFilter.addEventListener('input', searchWithDebounce);
if (priceMaxFilter) priceMaxFilter.addEventListener('input', searchWithDebounce);

// Búsqueda inmediata para selects
if (categoryFilter) categoryFilter.addEventListener('change', searchWithFilters);
if (ratingFilter) ratingFilter.addEventListener('change', searchWithFilters);
if (sortByFilter) sortByFilter.addEventListener('change', searchWithFilters);
if (sortOrderFilter) sortOrderFilter.addEventListener('change', searchWithFilters);

// WebSocket y notificaciones
let socket = null;
let currentUserId = null;

async function initNotifications() {
  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
  if (!token) return;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const user = await res.json();
    currentUserId = user.id;

    // Conectar al WebSocket del backend
    socket = io(`${CONFIG.API_BASE_URL}`, { auth: { token } });

    if (typeof window.initNotifications === 'function') {
      window.initNotifications(currentUserId, socket);
    }

    socket.on('new_notification', (notif) => {
      if (typeof window.handleNewNotification === 'function') {
        window.handleNewNotification(notif);
      }
    });
  } catch (err) {
    console.error('No se pudo inicializar notificaciones:', err);
  }
}

initNotifications();
