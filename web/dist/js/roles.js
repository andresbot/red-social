// Roles del sistema
export const Roles = {
    VISITOR: 'visitor',      // Usuario no autenticado
    CONSUMER: 'consumer',    // Solo consume servicios
    PROVIDER: 'provider',    // Solo provee servicios
    BOTH: 'both',            // Consume y provee
    ADMIN: 'admin'           // Administrador
};

// Labels de roles
export const RoleLabels = {
    visitor: 'Visitante',
    consumer: 'Comprador',
    provider: 'Proveedor',
    both: 'Pro',
    admin: 'Admin'
};

// Permisos por rol
export const RolePermissions = {
    visitor: {
        canViewServices: true,
        canContract: false,
        canPublish: false,
        canMessage: false,
        canUseWallet: false,
        canRate: false,
        canModerate: false
    },
    consumer: {
        canViewServices: true,
        canContract: true,
        canPublish: false,
        canMessage: true,
        canUseWallet: true,
        canRate: true,
        canModerate: false
    },
    provider: {
        canViewServices: true,
        canContract: false,
        canPublish: true,
        canMessage: true,
        canUseWallet: true,
        canRate: true,
        canModerate: false
    },
    both: {
        canViewServices: true,
        canContract: true,
        canPublish: true,
        canMessage: true,
        canUseWallet: true,
        canRate: true,
        canModerate: false
    },
    admin: {
        canViewServices: true,
        canContract: true,
        canPublish: true,
        canMessage: true,
        canUseWallet: true,
        canRate: true,
        canModerate: true
    }
};

// Verificar si un rol tiene un permiso específico
export function hasPermission(role, permission) {
    return RolePermissions[role]?.[permission] || false;
}
