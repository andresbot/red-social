// Utilidades generales
export const Utils = {
    // Formatear moneda Quetzales
    formatQZ(halves) {
        const qz = halves / 2;
        return `${qz.toFixed(1)} Q`;
    },
    
    // Formatear COP
    formatCOP(cents) {
        const cop = cents / 100;
        return `$${cop.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    },
    
    // Formatear fecha
    formatDate(date) {
        return new Date(date).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },
    
    // Formatear fecha y hora
    formatDateTime(date) {
        return new Date(date).toLocaleString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // Formatear fecha relativa (hace 2 horas, etc)
    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} día${days > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
        if (minutes > 0) return `${minutes} min`;
        return 'ahora';
    },
    
    // Mostrar toast notification
    showToast(message, type = 'info') {
        // TODO: Implementar toast notifications con librería
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Temporal: alert para errores críticos
        if (type === 'error') {
            // alert(message);
        }
    },
    
    // Validar email
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    // Generar ID único
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Debounce
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
