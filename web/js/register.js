import { Auth } from './auth.js';
import { Roles } from './roles.js';
import { Utils } from './utils.js';

function $(id) { return document.getElementById(id); }

async function handleSubmit(e) {
  e.preventDefault();
  const full_name = $('full_name').value.trim();
  const email = $('email').value.trim();
  const password = $('password').value;
  const confirm = $('confirm').value;
  const user_type = 'both';
  const submitBtn = $('submitBtn');
  const emailError = $('emailError');
  const passwordError = $('passwordError');
  const formMessage = $('formMessage');

  emailError.style.display = 'none';
  passwordError.style.display = 'none';
  formMessage.textContent = '';

  if (!full_name || full_name.length < 3) {
    formMessage.className = 'error';
    formMessage.textContent = 'El nombre debe tener al menos 3 caracteres';
    return;
  }
  if (!Utils.isValidEmail(email)) {
    emailError.style.display = 'block';
    return;
  }
  if (password.length < 8 || password !== confirm) {
    passwordError.style.display = 'block';
    return;
  }

  const payload = { full_name, email, password, user_type };

  submitBtn.disabled = true;
  formMessage.textContent = 'Creando cuenta...';
  try {
    const ok = await Auth.register(payload);
    if (ok) {
      Utils.showToast('Cuenta creada exitosamente', 'success');
      formMessage.className = 'success';
      formMessage.textContent = '¡Bienvenido! Redirigiendo al panel...';
      setTimeout(() => { window.location.href = '/'; }, 800);
    } else {
      formMessage.className = 'error';
      formMessage.textContent = 'No se pudo crear la cuenta.';
    }
  } catch (err) {
    console.error(err);
    formMessage.className = 'error';
    const msg = (err && err.message) ? err.message : 'Error del servidor. Intenta de nuevo.';
    const normalized = msg.includes('Email exists') ? 'El correo ya está registrado.' : msg;
    formMessage.textContent = normalized;
  } finally {
    submitBtn.disabled = false;
  }
}

function init() {
  const form = document.getElementById('registerForm');
  form.addEventListener('submit', handleSubmit);
}

document.addEventListener('DOMContentLoaded', init);
