// Configuración de la aplicación
export const CONFIG = {
    API_BASE_URL: (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3000',
    STORAGE_KEYS: {
        TOKEN: 'token',
        USER_ROLE: 'userRole',
        USER_DATA: 'userData'
    }
};
