import { Auth } from './auth.js';
import { Utils } from './utils.js';

function $(id) { return document.getElementById(id); }

async function handleSubmit(e) {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  const submitBtn = $('submitBtn');
  const emailError = $('emailError');
  const formMessage = $('formMessage');

  emailError.style.display = 'none';
  formMessage.textContent = '';

  if (!Utils.isValidEmail(email)) {
    emailError.style.display = 'block';
    return;
  }
  if (!password || password.length < 8) {
    formMessage.className = 'error';
    formMessage.textContent = 'La contraseña debe tener al menos 8 caracteres';
    return;
  }

  submitBtn.disabled = true;
  formMessage.textContent = 'Ingresando...';
  try {
    const ok = await Auth.login(email, password);
    if (ok) {
      Utils.showToast('Bienvenido', 'success');
      formMessage.className = 'success';
      formMessage.textContent = 'Redirigiendo al panel...';
      setTimeout(() => { window.location.href = '../vistas/index.html'; }, 600);
    } else {
      formMessage.className = 'error';
      formMessage.textContent = 'Credenciales inválidas.';
    }
  } catch (err) {
    console.error(err);
    formMessage.className = 'error';
    const msg = (err && err.message) ? err.message : 'Error del servidor. Intenta de nuevo.';
    // Normalizar mensajes del backend a español
    const normalized = msg.includes('Invalid credentials') ? 'Credenciales inválidas.' : msg;
    formMessage.textContent = normalized;
  } finally {
    submitBtn.disabled = false;
  }
}

function init() {
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', handleSubmit);
}

document.addEventListener('DOMContentLoaded', init);
