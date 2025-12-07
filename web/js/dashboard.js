import { Roles, RoleLabels } from './roles.js';
import { AppState } from './state.js';
import { Utils } from './utils.js';
import { API } from './api.js';

// Dashboard Controller
export const Dashboard = {
    // Inicializar dashboard
    async init() {
        console.log('Inicializando dashboard...');
        
        // Aplicar permisos según rol
        this.applyRolePermissions();
        
        // Actualizar UI con rol
        this.updateRoleBadge();
        
        // Verificar autenticación
        if (!AppState.token) {
            console.log('ℹ️ No hay token, usando rol:', AppState.userRole);
            this.loadMockData();
            return;
        }
        
        try {
            await this.loadData();
        } catch (error) {
            console.error('Error cargando datos:', error);
            this.loadMockData();
        }
    },
    
    // Aplicar permisos según rol del usuario
    applyRolePermissions() {
        const userRole = AppState.userRole;
        console.log('🔒 Aplicando permisos para rol:', userRole);
        
        // Ocultar/mostrar items del menú según rol
        document.querySelectorAll('.nav-item[data-role]').forEach(item => {
            const allowedRoles = item.getAttribute('data-role').split(',');
            
            // Admins ven todo
            if (userRole === Roles.ADMIN) {
                item.classList.remove('hidden');
                return;
            }
            
            // Verificar si el rol del usuario está en los roles permitidos
            if (allowedRoles.includes(userRole)) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    },
    
    // Actualizar badge de rol en header
    updateRoleBadge() {
        const badge = document.getElementById('user-role-badge');
        if (!badge) return;
        
        badge.textContent = RoleLabels[AppState.userRole] || 'Usuario';
        badge.className = `user-role ${AppState.userRole}`;
    },
    
    // Cargar datos reales del API
    async loadData() {
        try {
            // Cargar servicios
            const services = await API.get('/services');
            AppState.services = services;
            this.updateServicesCount(services.length);
            this.renderServices(services);
            
            // TODO: Cargar wallet balance cuando esté implementado
            // const wallet = await API.get('/wallet/balance');
            // this.updateBalance(wallet.balance_qz_halves);
            
        } catch (error) {
            console.error('Error cargando datos:', error);
        }
    },
    
    // Cargar datos de prueba
    loadMockData() {
        console.log('🧪 Cargando datos de prueba...');
        
        const role = AppState.userRole;
        
        // Mock data base
        let mockBalance = 0;
        let mockServices = 0;
        let mockMessages = 0;
        let mockRating = 5.0;
        let mockServicesList = [];
        
        // Datos según rol
        if (role === Roles.PROVIDER || role === Roles.BOTH) {
            mockBalance = 50; // 25 QZ
            mockServices = 3;
            mockMessages = 5;
            mockRating = 4.8;
            
            mockServicesList = [
                {
                    id: 1,
                    title: 'Desarrollo Web Frontend',
                    price_qz_halves: 62,
                    status: 'active'
                },
                {
                    id: 2,
                    title: 'Diseño UI/UX',
                    price_qz_halves: 40,
                    status: 'active'
                }
            ];
        } else if (role === Roles.CONSUMER) {
            mockBalance = 100; // 50 QZ
            mockMessages = 2;
        } else if (role === Roles.ADMIN) {
            mockBalance = 1000;
            mockServices = 150;
            mockMessages = 25;
            mockRating = 4.9;
        }
        
        this.updateBalance(mockBalance);
        this.updateServicesCount(mockServices);
        this.updateMessagesCount(mockMessages);
        this.updateRating(mockRating);
        
        if (mockServicesList.length > 0) {
            this.renderServices(mockServicesList);
        }
        this.renderActivity();
        
        // Actualizar notificaciones
        const notifCount = role === Roles.ADMIN ? 12 : (role === Roles.VISITOR ? 0 : 3);
        const notifBadge = document.getElementById('notifications-count');
        if (notifBadge) {
            notifBadge.textContent = notifCount;
            notifBadge.style.display = notifCount === 0 ? 'none' : 'inline';
        }
    },
    
    // Actualizar balance
    updateBalance(halves) {
        const balanceEl = document.getElementById('balance');
        if (balanceEl) {
            balanceEl.textContent = Utils.formatQZ(halves);
        }
    },
    
    // Actualizar contador de servicios
    updateServicesCount(count) {
        const servicesEl = document.getElementById('active-services');
        if (servicesEl) {
            servicesEl.textContent = count;
        }
    },
    
    // Actualizar contador de mensajes
    updateMessagesCount(count) {
        const messagesEl = document.getElementById('messages');
        if (messagesEl) {
            messagesEl.textContent = count;
        }
    },
    
    // Actualizar rating
    updateRating(rating) {
        const ratingEl = document.getElementById('rating');
        if (ratingEl) {
            ratingEl.textContent = rating.toFixed(1);
        }
    },
    
    // Renderizar lista de servicios
    renderServices(services) {
        const container = document.getElementById('recent-services');
        if (!container) return;
        
        if (!services || services.length === 0) {
            return;
        }
        
        container.innerHTML = services.map(service => `
            <div class="service-item" data-id="${service.id}">
                <div class="service-info">
                    <h4 class="service-title">${service.title}</h4>
                    <p class="service-price">${Utils.formatQZ(service.price_qz_halves)}</p>
                </div>
                <span class="service-status ${service.status}">${service.status}</span>
            </div>
        `).join('');
    },
    
    // Renderizar actividad reciente
    renderActivity() {
        const container = document.getElementById('recent-activity');
        if (!container) return;
        
        const mockActivity = [
            { type: 'service', message: 'Nuevo servicio publicado', time: '2 horas' },
            { type: 'message', message: 'Nuevo mensaje recibido', time: '5 horas' },
            { type: 'payment', message: 'Pago recibido', time: '1 día' }
        ];
        
        container.innerHTML = mockActivity.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}"></div>
                <div class="activity-content">
                    <p class="activity-message">${activity.message}</p>
                    <p class="activity-time">${activity.time}</p>
                </div>
            </div>
        `).join('');
    }
};
