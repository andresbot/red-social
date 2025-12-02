/**
 * Quetzal Platform - Main Application Entry Point
 * Imports all modules and initializes the application
 */

import { CONFIG } from './config.js';
import { Roles, RoleLabels, hasPermission } from './roles.js';
import { AppState, updateState } from './state.js';
import { Utils } from './utils.js';
import { API } from './api.js';
import { Auth } from './auth.js';
import { Dashboard } from './dashboard.js';

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Quetzal Platform iniciando...');
    
    // Verificar si el usuario está autenticado
    if (!Auth.isAuthenticated()) {
        console.log('👤 Usuario no autenticado, redirigiendo a landing...');
        window.location.href = '/vistas/visitante.html';
        return;
    }
    
    // Inicializar dashboard
    Dashboard.init();
    
    // Listener para navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Si el item tiene href absoluto a una ruta, permitir navegación
            const href = item.getAttribute('href');
            const hasPage = item.hasAttribute('data-page');

            // No prevenir navegación a rutas como /publicar-servicio
            if (href && href.startsWith('/')) {
                return; // dejar que el navegador navegue
            }

            // SPA: sólo prevenir por items de página interna
            if (hasPage) {
                e.preventDefault();
            }
            
            if (item.classList.contains('hidden')) return;
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const page = item.getAttribute('data-page');
            if (page) {
                console.log('📄 Navegando a:', page);
                // TODO: Implementar router para cambiar vistas
            }
        });
    });
    
    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
    }
    
    // Notificaciones
    const notifBtn = document.getElementById('notifications-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            console.log('🔔 Mostrando notificaciones');
            // TODO: Implementar panel de notificaciones
        });
    }
    
    console.log('✅ Aplicación lista');
    console.log('💡 Tip: Usa testRole("provider") para cambiar de rol en desarrollo');
});

// Exponer funciones de testing en desarrollo
if (CONFIG.API_BASE_URL.includes('localhost')) {
    window.testRole = (role) => {
        if (Auth.changeRole(role)) {
            Dashboard.init();
        }
    };
    
    window.testLogin = async (email = 'demo@quetzal.com', password = 'Demo123') => {
        const success = await Auth.login(email, password);
        if (success) {
            Dashboard.init();
        }
        return success;
    };
}

// Exportar para uso global
window.Quetzal = {
    CONFIG,
    Roles,
    RoleLabels,
    AppState,
    Utils,
    API,
    Auth,
    Dashboard,
    hasPermission
};

