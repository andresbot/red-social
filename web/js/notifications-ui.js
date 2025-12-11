// web/js/notifications-ui.js
import { API } from './api.js';

export class NotificationUI {
  constructor() {
    this.badgeEl = document.getElementById('notifications-count');
    this.bellBtn = document.getElementById('notifications-btn');
    this.dropdown = null;
    this.socket = null; // se inyectará desde fuera
  }

  // Inicializa el sistema de notificaciones
  async init(socket) {
    if (!this.badgeEl || !this.bellBtn) return; // si no hay UI, no hacer nada

    this.socket = socket;

    // Cargar conteo inicial
    await this.loadUnreadCount();

    // Abrir dropdown al hacer clic
    this.bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', () => {
      if (this.dropdown) {
        this.closeDropdown();
      }
    });

    // Escuchar notificaciones en tiempo real
    if (this.socket) {
      this.socket.on('new_notification', (notif) => {
        // Actualizar badge
        const current = parseInt(this.badgeEl.textContent) || 0;
        this.badgeEl.textContent = current + 1;

        // Mostrar toast opcional
        this.showToast(notif.title, notif.message);

        // Si el dropdown está abierto, añadir notificación
        if (this.dropdown && this.dropdown.style.display !== 'none') {
          this.prependNotification(notif);
        }
      });
    }
  }

  async loadUnreadCount() {
    try {
      const res = await API.get('/notifications/unread');
      this.badgeEl.textContent = res.count || 0;
    } catch (err) {
      console.warn('No se pudo cargar el conteo de notificaciones');
    }
  }

  async toggleDropdown() {
    if (this.dropdown && this.dropdown.style.display !== 'none') {
      this.closeDropdown();
    } else {
      await this.openDropdown();
    }
  }

  async openDropdown() {
    if (!this.dropdown) {
      this.dropdown = document.createElement('div');
      this.dropdown.className = 'dropdown-menu';
      this.dropdown.style.cssText = `
        position: absolute;
        top: 60px;
        right: 24px;
        width: 360px;
        max-height: 400px;
        background: var(--bg-primary);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        overflow-y: auto;
      `;
      document.body.appendChild(this.dropdown);
    }

    // Cargar notificaciones
    try {
      const notifs = await API.get('/notifications?limit=10');
      this.renderNotifications(notifs);
    } catch (err) {
      this.dropdown.innerHTML = '<div class="helper" style="padding:16px;">Error al cargar notificaciones</div>';
    }

    this.dropdown.style.display = 'block';
  }

  closeDropdown() {
    if (this.dropdown) {
      this.dropdown.style.display = 'none';
    }
  }

  renderNotifications(notifications) {
    if (!this.dropdown) return;

    if (notifications.length === 0) {
      this.dropdown.innerHTML = '<div class="helper" style="padding:16px;">No tienes notificaciones</div>';
      return;
    }

    this.dropdown.innerHTML = notifications.map(n => `
      <div class="notification-item" style="padding:12px 16px; border-bottom:1px solid var(--border); cursor:pointer; ${n.is_read ? 'opacity:0.7;' : 'background: var(--bg-secondary);'}"
           data-id="${n.id}" onclick="window.location.href='${n.action_url}'">
        <div style="font-weight:600;">${n.title}</div>
        <div class="helper" style="font-size:13px; margin-top:4px;">${n.message}</div>
        <div class="helper" style="font-size:11px; margin-top:4px; color: var(--text-tertiary);">
          ${new Date(n.created_at).toLocaleString()}
        </div>
      </div>
    `).join('');

    // Marcar todas como leídas al abrir
    this.markAllAsRead();
  }

  prependNotification(notif) {
    if (!this.dropdown) return;
    const item = document.createElement('div');
    item.className = 'notification-item';
    item.style.cssText = 'padding:12px 16px; border-bottom:1px solid var(--border); background: var(--bg-secondary);';
    item.innerHTML = `
      <div style="font-weight:600;">${notif.title}</div>
      <div class="helper" style="font-size:13px; margin-top:4px;">${notif.message}</div>
      <div class="helper" style="font-size:11px; margin-top:4px; color: var(--text-tertiary);">
        ${new Date(notif.createdAt).toLocaleString()}
      </div>
    `;
    item.addEventListener('click', () => {
      window.location.href = notif.actionUrl;
    });
    this.dropdown.prepend(item);
  }

  async markAllAsRead() {
    try {
      await API.patch('/notifications/read-all');
      this.badgeEl.textContent = '0';
      // Opcional: actualizar estilo de notificaciones en el dropdown
    } catch (err) {
      console.warn('No se pudieron marcar como leídas');
    }
  }

  showToast(title, message) {
    // Opcional: muestra un toast flotante
    const toast = document.createElement('div');
    toast.innerHTML = `
      <div style="position: fixed; bottom: 20px; right: 20px; background: var(--primary); color: white; padding: 12px 16px; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 9999;">
        <strong>${title}</strong><br>${message}
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }
}