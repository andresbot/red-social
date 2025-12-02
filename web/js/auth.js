import { CONFIG } from './config.js';
import { Roles } from './roles.js';
import { AppState, clearState, updateState } from './state.js';
import { API } from './api.js';
import { Utils } from './utils.js';

// Sistema de autenticación
export const Auth = {
    // Login
    async login(email, password) {
        try {
            const response = await API.post('/auth/login', { email, password });
            
            if (response.token) {
                AppState.token = response.token;
                localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, response.token);
                await this.loadUserData();
                Utils.showToast('Sesión iniciada correctamente', 'success');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },
    
    // Registro
    async register(userData) {
        try {
            const response = await API.post('/auth/register', userData);
            
            if (response.token) {
                AppState.token = response.token;
                localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, response.token);
                const role = response.user?.user_type || 'both';
                AppState.userRole = role;
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ROLE, role);
                Utils.showToast('Cuenta creada exitosamente', 'success');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Register error:', error);
            throw error;
        }
    },
    
    // Cargar datos del usuario autenticado
    async loadUserData() {
        try {
            const user = await API.get('/users/me');
            AppState.user = user;
            AppState.userRole = user.user_type || Roles.BOTH;
            
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ROLE, AppState.userRole);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(user));
            
            return user;
        } catch (error) {
            console.error('Error loading user data:', error);
            return null;
        }
    },
    
    // Logout
    logout() {
        // Limpiar estado
        clearState();
        
        // Limpiar localStorage
        localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_ROLE);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
        
        // Redirigir a login (o recargar para mostrar vista visitante)
        window.location.href = '/';
    },
    
    // Verificar si está autenticado
    isAuthenticated() {
        return !!AppState.token;
    },
    
    // Obtener usuario actual
    getCurrentUser() {
        return AppState.user;
    },
    
    // Cambiar rol (solo para testing en desarrollo)
    changeRole(newRole) {
        if (!Object.values(Roles).includes(newRole)) {
            console.error('Rol inválido:', newRole);
            return false;
        }
        
        AppState.userRole = newRole;
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER_ROLE, newRole);
        console.log('🔄 Rol cambiado a:', newRole);
        
        return true;
    }
};
