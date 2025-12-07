// web/js/config.js
// Detecta si estás en localhost o en producción
const isLocal = window.location.hostname === 'localhost';

export const CONFIG = {
  API_BASE_URL: isLocal
    ? 'http://localhost:3000'
    : 'https://quetzal-backend.onrender.com',

    STORAGE_KEYS: {
    TOKEN: 'quetzal_token',
    USER_ROLE: 'quetzal_user_role',
    USER_DATA: 'quetzal_user_data'
  }
};

