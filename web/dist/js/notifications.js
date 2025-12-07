// notifications.js - Sistema de notificaciones en tiempo real

class NotificationUI {
  constructor() {
    this.badge = document.getElementById('notifications-count');
    this.dropdown = null; // Se creará al abrir
    this.socket = null;
    this.userId = null;
  }

  // Inicializar con el socket y userId ya existentes
  init(userId, socket) {
    this.userId = userId;
    this.socket = socket;
    this.bindEvents();
    this.loadUnreadCount();
  }

  // Cargar contador inicial
  async loadUnreadCount() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/notifications/unread', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const { count } = await res.json();
        this.updateBadge(count);
      }
    } catch (err) {
      console.error('Error al cargar notificaciones:', err);
    }
  }

  // Actualizar badge visual
  updateBadge(count) {
    if (this.badge) {
      this.badge.textContent = count;
      this.badge.style.display = count > 0 ? 'inline' : 'none';
    }
  }

  // Enlazar eventos
  bindEvents() {
    const bellBtn = document.getElementById('notifications-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', () => {
      if (this.dropdown) {
        this.dropdown.remove();
        this.dropdown = null;
      }
    });
  }

  // Alternar dropdown de notificaciones
  async toggleDropdown() {
    if (this.dropdown) {
      this.dropdown.remove();
      this.dropdown = null;
      return;
    }

    // Crear dropdown
    this.dropdown = document.createElement('div');
    this.dropdown.style.cssText = `
      position: absolute;
      top: 60px;
      right: 20px;
      width: 320px;
      max-height: 400px;
      background: white;
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      overflow-y: auto;
    `;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/notifications?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const notifications = await res.json();
        if (notifications.length === 0) {
          this.dropdown.innerHTML = '<div class="helper" style="padding: 12px; text-align: center;">No tienes notificaciones</div>';
        } else {
          notifications.forEach(n => this.renderNotificationItem(n));
        }
      }
    } catch (err) {
      this.dropdown.innerHTML = '<div class="helper" style="padding: 12px; text-align: center;">Error al cargar</div>';
    }

    document.body.appendChild(this.dropdown);
  }

  // Renderizar una notificación en el dropdown
  renderNotificationItem(notification) {
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      background: ${notification.is_read ? 'transparent' : 'var(--bg-secondary)'};
    `;
    item.innerHTML = `
      <div style="font-weight: 600; color: var(--text);">${notification.title}</div>
      <div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">${notification.message}</div>
      <div style="color: var(--text-tertiary); font-size: 12px; margin-top: 6px; text-align: right;">
        ${new Date(notification.created_at).toLocaleDateString()}
      </div>
    `;

    item.addEventListener('click', async () => {
      // Marcar como leída
      try {
        const token = localStorage.getItem('token');
        await fetch(`/notifications/${notification.id}/read`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        item.style.background = 'transparent';
        item.style.opacity = '0.7';
      } catch (err) {
        console.error('Error al marcar como leída:', err);
      }

      // Redirigir
      if (notification.action_url) {
        window.location.href = notification.action_url;
      }
    });

    this.dropdown?.appendChild(item);
  }

  // Manejar notificación en tiempo real
  onNewNotification(notification) {
    // Actualizar badge (asumimos +1 no leída)
    this.loadUnreadCount();

    // Si el dropdown está abierto, agregar la notificación
    if (this.dropdown) {
      this.renderNotificationItem({ ...notification, is_read: false });
    }
  }
}

// Instancia global
const notificationUI = new NotificationUI();

// Función para inicializar desde otras vistas
window.initNotifications = (userId, socket) => {
  notificationUI.init(userId, socket);
};

// Escuchar evento de WebSocket (se llamará desde mensajes.js o perfil.js)
window.handleNewNotification = (notif) => {
  notificationUI.onNewNotification(notif);
};