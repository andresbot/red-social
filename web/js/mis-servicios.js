// Mis Servicios: obtiene y renderiza servicios del usuario
import { API } from './api.js';
import { CONFIG } from './config.js';

const listEl = document.getElementById('servicesList');
const msgEl = document.getElementById('servicesMessage');
const modalEl = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editFields = {
  id: document.getElementById('edit_id'),
  title: document.getElementById('edit_title'),
  category: document.getElementById('edit_category'),
  price: document.getElementById('edit_price'),
  delivery: document.getElementById('edit_delivery'),
  description: document.getElementById('edit_description'),
  requirements: document.getElementById('edit_requirements'),
  image: document.getElementById('edit_image'),
};
const editMessage = document.getElementById('editMessage');
const editCancelBtn = document.getElementById('editCancel');

function showMessage(text, type = 'info') {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.style.display = 'block';
}

function openEditModal(svc) {
  if (!modalEl) return;
  editFields.id.value = svc.id;
  editFields.title.value = svc.title || '';
  editFields.category.value = svc.category || 'otro';
  const priceQZ = typeof svc.price_qz_halves === 'number' ? (svc.price_qz_halves / 2) : (svc.price_halves ? svc.price_halves / 2 : 0.5);
  editFields.price.value = priceQZ.toFixed(1);
  editFields.delivery.value = svc.delivery_time || '';
  editFields.description.value = svc.description || '';
  editFields.requirements.value = svc.requirements || '';
  editMessage.style.display = 'none';
  modalEl.style.display = 'flex';
}

function closeEditModal() {
  if (modalEl) modalEl.style.display = 'none';
}

function renderServiceItem(svc) {
  const container = document.createElement('div');
  container.className = 'card';
  container.style.marginBottom = '12px';

  const header = document.createElement('div');
  header.className = 'card-header';
  const thumb = svc.image_url
    ? `<img src="${svc.image_url}" alt="Imagen" style="width:48px;height:48px;border-radius:8px;object-fit:cover;margin-right:12px;border:1px solid var(--border);" />`
    : `<div style="width:48px;height:48px;border-radius:8px;margin-right:12px;border:1px solid var(--border);background: var(--bg-tertiary);display:flex;align-items:center;justify-content:center;color: var(--text-tertiary);">
         <i class="fas fa-image"></i>
       </div>`;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      ${thumb}
      <h3 class="card-title" style="font-size: 16px; margin:0; display:flex; align-items:center; gap:8px;">
        <i class="fas fa-briefcase" style="color: var(--primary);"></i>
        ${svc.title || 'Sin título'}
      </h3>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'card-body';
  const halves = Number(svc.price_qz_halves ?? svc.price_halves ?? 0);
  const priceQZ = (halves / 2).toFixed(1);
  const isInactive = svc.status === 'inactive';
  body.innerHTML = `
    <div class="input-row">
      <div class="form-group">
        <label class="form-label"><i class="fas fa-tag"></i> Categoría</label>
        <div class="helper">${svc.category || '-'}</div>
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fas fa-coins"></i> Precio</label>
        <div class="helper">${priceQZ} QZ</div>
      </div>
      <div class="form-group">
        <label class="form-label"><i class="fas fa-clock"></i> Entrega</label>
        <div class="helper">${svc.delivery_time || '-'}</div>
      </div>
    </div>
    <div class="form-actions" style="justify-content: flex-start;">
      <button class="btn-primary" data-action="edit"><i class="fas fa-pen"></i> Editar</button>
      <button class="${isInactive ? 'btn-success' : 'btn-danger'}" data-action="toggle"><i class="fas fa-power-off"></i> ${isInactive ? 'Activar' : 'Desactivar'}</button>
    </div>
  `;

  body.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal(svc));

  const toggleBtn = body.querySelector('[data-action="toggle"]');
  toggleBtn.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
      const res = await fetch(`${CONFIG.API_BASE_URL}/services/${svc.id}/toggle`, { 
        method: 'PATCH', 
        headers: { 
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        } 
      });
      if (!res.ok) throw new Error('Error al cambiar estado');
      const data = await res.json();
      showMessage(`Estado actualizado: ${data.status}`);
      // Actualizar etiqueta del botón según nuevo estado
      const isInactive = data.status === 'inactive';
      toggleBtn.innerHTML = `<i class="fas fa-power-off"></i> ${isInactive ? 'Activar' : 'Desactivar'}`;
      toggleBtn.className = isInactive ? 'btn-success' : 'btn-danger';
      // Opcional: actualizar objeto en memoria
      svc.status = data.status;
    } catch (err) {
      showMessage('No se pudo cambiar el estado del servicio.');
    } finally {
      e.target.disabled = false;
    }
  });

  container.appendChild(header);
  container.appendChild(body);
  return container;
}

async function fetchServices() {
  if (!listEl) return;
  listEl.innerHTML = '';
  try {
    const data = await API.get('/services');
    const items = Array.isArray(data?.services) ? data.services : (Array.isArray(data) ? data : []);
    if (items.length === 0) {
      showMessage('No tienes servicios publicados aún. Crea uno nuevo.');
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(svc => frag.appendChild(renderServiceItem(svc)));
    listEl.appendChild(frag);
  } catch (err) {
    showMessage('No se pudieron cargar tus servicios.');
  }
}

// Inicializar
fetchServices();

// Edit form handlers
if (editCancelBtn) editCancelBtn.addEventListener('click', closeEditModal);

if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editFields.id.value;
    const title = editFields.title.value.trim();
    const category = editFields.category.value;
    const description = editFields.description.value.trim();
    const delivery_time = editFields.delivery.value;
    const price_qz_halves = Math.round(parseFloat(editFields.price.value) * 2);

    // Validaciones rápidas en cliente
    if (title.length < 10 || description.length < 50 || !delivery_time) {
      editMessage.textContent = 'Revisa los campos: título, descripción y entrega.';
      editMessage.style.display = 'block';
      return;
    }

    // Usar FormData si hay imagen; JSON si no
    const imageFile = editFields.image && editFields.image.files && editFields.image.files[0];
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    let res;
    try {
      if (imageFile) {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category);
        formData.append('description', description);
        formData.append('delivery_time', delivery_time);
        formData.append('price_qz_halves', String(price_qz_halves));
        formData.append('requirements', editFields.requirements.value.trim());
        formData.append('image', imageFile);
        res = await fetch(`${CONFIG.API_BASE_URL}/services/${id}`, { 
          method: 'PATCH', 
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData 
        });
      } else {
        const payload = { title, category, description, delivery_time, price_qz_halves, requirements: editFields.requirements.value.trim() };
        res = await fetch(`${CONFIG.API_BASE_URL}/services/${id}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json', 
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }
      if (!res.ok) throw new Error('Error al actualizar');
      editMessage.textContent = 'Servicio actualizado correctamente.';
      editMessage.style.display = 'block';
      closeEditModal();
      fetchServices();
    } catch (err) {
      editMessage.textContent = 'No se pudo actualizar el servicio.';
      editMessage.style.display = 'block';
    }
  });
}
