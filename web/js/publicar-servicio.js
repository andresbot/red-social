import { Auth } from './auth.js';
import { Utils } from './utils.js';
import { API } from './api.js';
import { hasPermission } from './roles.js';
import { AppState } from './state.js';

function $(id) { return document.getElementById(id); }

async function handleSubmit(e) {
  e.preventDefault();
  
  const submitBtn = $('submitBtn');
  const formMessage = $('formMessage');
  
  // Obtener datos del formulario
  const title = $('title').value.trim();
  const category = $('category').value;
  const description = $('description').value.trim();
  const price = parseFloat($('price').value);
  const delivery_time = $('delivery_time').value;
  const requirements = $('requirements').value.trim();
  const imageInput = $('image');
  
  // Validaciones básicas
  if (title.length < 10) {
    showMessage('El título debe tener al menos 10 caracteres', 'error');
    return;
  }
  
  if (description.length < 50) {
    showMessage('La descripción debe tener al menos 50 caracteres', 'error');
    return;
  }
  
  if (!category) {
    showMessage('Debes seleccionar una categoría', 'error');
    return;
  }
  
  if (price < 0.5) {
    showMessage('El precio mínimo es 0.5 QZ', 'error');
    return;
  }
  
  // Convertir precio a halves (0.5 QZ = 1 half)
  const price_qz_halves = Math.round(price * 2);
  
  // Usar FormData para soportar archivo
  const formData = new FormData();
  formData.append('title', title);
  formData.append('category', category);
  formData.append('description', description);
  formData.append('price_qz_halves', String(price_qz_halves));
  formData.append('delivery_time', delivery_time);
  if (requirements) formData.append('requirements', requirements);
  if (imageInput && imageInput.files && imageInput.files[0]) {
    formData.append('image', imageInput.files[0]);
  }
  
  submitBtn.disabled = true;
  showMessage('Publicando servicio...', 'info');
  
  try {
    const result = await API.postMultipart('/services', formData);
    
    if (result && result.id) {
      showMessage('¡Servicio publicado exitosamente!', 'success');
      Utils.showToast('Servicio publicado', 'success');
      
      // Redirigir después de 1.5 segundos
      setTimeout(() => {
        window.location.href = '/vistas/index.html';
      }, 1500);
    } else {
      showMessage('No se pudo publicar el servicio', 'error');
    }
  } catch (err) {
    console.error('Error al publicar servicio:', err);
    const errorMsg = err.message || 'Error del servidor. Intenta de nuevo.';
    showMessage(errorMsg, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function showMessage(text, type) {
  const formMessage = $('formMessage');
  formMessage.textContent = text;
  formMessage.style.display = 'block';
  
  // Colores según tipo
  if (type === 'success') {
    formMessage.style.background = '#d1fae5';
    formMessage.style.color = '#065f46';
    formMessage.style.border = '1px solid #10b981';
  } else if (type === 'error') {
    formMessage.style.background = '#fee2e2';
    formMessage.style.color = '#991b1b';
    formMessage.style.border = '1px solid #ef4444';
  } else {
    formMessage.style.background = '#dbeafe';
    formMessage.style.color = '#1e40af';
    formMessage.style.border = '1px solid #3b82f6';
  }
}

function init() {
  // Verificar autenticación
  if (!Auth.isAuthenticated()) {
    window.location.href = '/';
    return;
  }
  
  // Permiso: todas las cuentas pueden publicar (rol por defecto BOTH)
  
  // Event listeners
  const form = document.getElementById('serviceForm');
  form.addEventListener('submit', handleSubmit);
  
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      Auth.logout();
    });
  }
  
  // Header: avatar y notificaciones
  const avatar = document.getElementById('user-avatar');
  const notifBtn = document.getElementById('notifications-btn');
  const notifCount = document.getElementById('notifications-count');
  
  // Cargar datos de usuario si no están
  if (!AppState.user) {
    Auth.loadUserData().then(() => {
      if (avatar && AppState.user?.full_name) {
        const name = encodeURIComponent(AppState.user.full_name);
        avatar.src = `https://ui-avatars.com/api/?name=${name}&background=6366f1&color=fff`;
      }
    });
  } else if (avatar && AppState.user?.full_name) {
    const name = encodeURIComponent(AppState.user.full_name);
    avatar.src = `https://ui-avatars.com/api/?name=${name}&background=6366f1&color=fff`;
  }
  
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      // Placeholder: aumentar contador para demostrar interacción
      const current = Number(notifCount?.textContent || '0');
      if (notifCount) notifCount.textContent = String(current + 1);
    });
  }
  
  // Contador de caracteres para descripción
  const descriptionInput = $('description');
  descriptionInput.addEventListener('input', () => {
    const length = descriptionInput.value.length;
    const helper = descriptionInput.nextElementSibling;
    helper.textContent = `${length} / 2000 caracteres (mínimo 50)`;
  });
}

document.addEventListener('DOMContentLoaded', init);
