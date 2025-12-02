import { CONFIG } from './config.js';
import { Roles } from './roles.js';

// Estado global de la aplicación
export const AppState = {
    user: null,
    token: localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN),
    userRole: localStorage.getItem(CONFIG.STORAGE_KEYS.USER_ROLE) || Roles.VISITOR,
    services: [],
    messages: [],
    notifications: []
};

// Actualizar estado
export function updateState(key, value) {
    AppState[key] = value;
}

// Limpiar estado (logout)
export function clearState() {
    AppState.user = null;
    AppState.token = null;
    AppState.userRole = Roles.VISITOR;
    AppState.services = [];
    AppState.messages = [];
    AppState.notifications = [];
}
