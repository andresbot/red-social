# Sistema de Roles - Quetzal Platform

## Roles Definidos

### 1. Visitante (visitor)
- **Descripción**: Usuario no autenticado
- **Permisos**:
  - Ver catálogo de servicios público
  - Ver perfiles de proveedores
  - Registrarse/Login
- **Restricciones**:
  - No puede contratar servicios
  - No puede enviar mensajes
  - No tiene cartera
  - No ve dashboard completo

### 2. Consumidor (consumer)
- **Descripción**: Usuario que solo consume/compra servicios
- **Permisos**:
  - Buscar y filtrar servicios
  - Contratar servicios
  - Enviar mensajes a proveedores
  - Gestionar su cartera (cargar fondos)
  - Calificar servicios contratados
  - Ver historial de contratos
- **Navegación visible**:
  - Inicio
  - Buscar Servicios
  - Contratos
  - Mensajes
  - Cartera
  - Perfil

### 3. Proveedor (provider)
- **Descripción**: Usuario que solo ofrece/vende servicios
- **Permisos**:
  - Publicar servicios
  - Editar/pausar servicios
  - Recibir solicitudes
  - Gestionar contratos
  - Recibir pagos en cartera
  - Retirar fondos
  - Ver estadísticas de servicios
- **Navegación visible**:
  - Inicio
  - Mis Servicios
  - Contratos
  - Mensajes
  - Cartera
  - Perfil

### 4. Ambos (both)
- **Descripción**: Usuario que consume Y provee servicios (híbrido)
- **Permisos**:
  - Todos los permisos de Consumer
  - Todos los permisos de Provider
  - Vista completa del dashboard
- **Navegación visible**:
  - Inicio
  - Mis Servicios
  - Buscar Servicios
  - Contratos
  - Mensajes
  - Cartera
  - Perfil

### 5. Administrador (admin)
- **Descripción**: Moderador/administrador de la plataforma
- **Permisos**:
  - Moderar servicios
  - Gestionar disputas
  - Ver reportes de usuarios
  - Bloquear/desbloquear usuarios
  - Ver métricas de plataforma
  - Acceso a panel de administración
  - Gestionar transacciones sospechosas
- **Navegación visible**:
  - Todos los items anteriores
  - Administración

## Flujo de Roles

```
Visitante → Registro → Consumer/Provider/Both
                ↓
              Login
                ↓
         Dashboard según rol
```

## Testing de Roles (Dev)

En la consola del navegador:

```javascript
// Cambiar a proveedor
testRole('provider');

// Cambiar a consumidor
testRole('consumer');

// Cambiar a ambos
testRole('both');

// Cambiar a admin
testRole('admin');

// Ver rol actual
console.log(AppState.userRole);
```

## Implementación Frontend

### HTML
- Atributo `data-role="consumer,provider"` en elementos del menú
- Elementos ocultos/visibles según permisos

### JavaScript
```javascript
// Verificar permiso
if (AppState.userRole === Roles.PROVIDER || AppState.userRole === Roles.BOTH) {
    // Mostrar botón "Publicar Servicio"
}

// Aplicar permisos
Dashboard.applyRolePermissions();
```

### CSS
```css
.nav-item.hidden {
    display: none !important;
}
```

## Backend (por implementar)

### Middleware de autorización
```typescript
// Verificar rol en endpoints
requireRole(['provider', 'both'])
requireRole(['admin'])
```

### Base de datos
- `users.user_type`: 'consumer' | 'provider' | 'both'
- `admin_users`: tabla separada para admins
- `admin_roles`: roles con permisos JSON

## Matriz de Permisos

| Acción | Visitor | Consumer | Provider | Both | Admin |
|--------|---------|----------|----------|------|-------|
| Ver servicios | ✅ | ✅ | ✅ | ✅ | ✅ |
| Contratar | ❌ | ✅ | ❌ | ✅ | ✅ |
| Publicar servicio | ❌ | ❌ | ✅ | ✅ | ✅ |
| Mensajería | ❌ | ✅ | ✅ | ✅ | ✅ |
| Cartera | ❌ | ✅ | ✅ | ✅ | ✅ |
| Calificar | ❌ | ✅ | ✅ | ✅ | ✅ |
| Moderar | ❌ | ❌ | ❌ | ❌ | ✅ |
| Gestionar disputas | ❌ | ❌ | ❌ | ❌ | ✅ |

## Notas

- El rol se almacena en `localStorage` y en JWT token
- Al hacer login, el backend devuelve el rol del usuario
- Los admins se gestionan en tabla separada con permisos JSONB
- Un usuario puede solicitar cambio de rol (consumer → both)
