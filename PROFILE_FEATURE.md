# Perfil de Usuario - Documentación

## Resumen
Se ha implementado la funcionalidad completa de perfil de usuario con las siguientes capacidades:
- Visualización del perfil del usuario autenticado
- Edición de información personal
- Cambio de contraseña seguro
- Estadísticas del usuario (servicios, contratos, rating)

## Archivos Creados/Modificados

### Frontend

#### `/web/vistas/perfil.html`
Vista HTML del perfil con:
- **Sección de visualización**: Avatar (iniciales o imagen), nombre, email, rol, teléfono, ciudad, bio, website
- **Estadísticas**: Servicios publicados, contratos completados, calificación
- **Formulario de edición**: Campos para actualizar nombre, teléfono, ciudad, bio (máx 500 chars), website
- **Cambio de contraseña**: Contraseña actual, nueva contraseña (mín 8 chars), confirmar contraseña

#### `/web/js/perfil.js`
JavaScript del perfil con:
- `loadProfile()`: Obtiene datos del usuario desde `/users/me`
- `renderProfile()`: Renderiza el perfil con badges de rol con colores específicos
- `loadStats()`: Obtiene estadísticas desde `/services` y `/contracts`
- `showEditForm()` / `cancelEdit()`: Alterna entre vista y edición
- Manejo de formularios con validación y mensajes de error específicos
- Auto-logout si el token es inválido (401)

### Backend

#### `/server/src/modules/users/routes.ts`
Endpoints implementados:

1. **GET /users/me** (protegido con `authenticate`)
   - Devuelve: id, email, full_name, phone, city, user_type, avatar, bio, website
   - Errores: 401 (no autenticado), 404 (usuario no encontrado)

2. **PATCH /users/me** (protegido con `authenticate`)
   - Actualiza: full_name, phone, city, bio, website
   - Validación: full_name mínimo 3 caracteres
   - Devuelve: Usuario actualizado
   - Errores: 400 (validación), 404 (usuario no encontrado)

3. **PATCH /users/me/password** (protegido con `authenticate`)
   - Requiere: current_password, new_password
   - Validación: nueva contraseña mínimo 8 caracteres
   - Verifica contraseña actual con Argon2
   - Hash de nueva contraseña con Argon2
   - Errores: 400 (validación), 403 (contraseña actual incorrecta), 404 (usuario no encontrado)

#### `/server/src/app.ts`
Agregada ruta:
```typescript
app.get('/perfil', (_req, res) => {
  res.sendFile(path.join(webPath, 'vistas', 'perfil.html'));
});
```

### Enlaces de Navegación
Actualizados los links del sidebar en:
- index.html
- mis-servicios.html
- buscar-servicios.html
- detalle-servicio.html
- contratos.html
- publicar-servicio.html

Cambio: `<a href="#" data-page="profile">` → `<a href="/perfil">`

## Flujo de Uso

### Visualizar Perfil
1. Usuario autenticado hace clic en "Perfil" en el sidebar
2. Frontend carga `/perfil` → `perfil.html`
3. `perfil.js` ejecuta `loadProfile()`:
   - GET /users/me con token Bearer
   - Renderiza datos del usuario
   - Carga estadísticas en paralelo

### Editar Perfil
1. Usuario hace clic en "Editar Perfil"
2. Se muestra formulario pre-llenado con datos actuales
3. Usuario modifica campos (nombre, teléfono, ciudad, bio, website)
4. Al hacer submit:
   - PATCH /users/me con token Bearer
   - Validación: nombre mínimo 3 chars
   - Si exitoso: actualiza vista y muestra mensaje de éxito
   - Si error: muestra mensaje específico

### Cambiar Contraseña
1. Usuario completa formulario de contraseña
2. Validación frontend: nueva contraseña mínimo 8 chars, confirmación coincide
3. Al hacer submit:
   - PATCH /users/me/password con token Bearer
   - Backend verifica contraseña actual con Argon2
   - Si válida: hash nueva contraseña y actualiza
   - Si exitoso: limpia formulario y muestra mensaje
   - Si error: muestra mensaje específico (contraseña incorrecta)

## Seguridad

- ✅ **Autenticación requerida**: Todos los endpoints usan middleware `authenticate`
- ✅ **Validación de identidad**: Usuario solo puede editar su propio perfil (via `req.userId` del token)
- ✅ **Verificación de contraseña actual**: Obligatoria antes de cambiar contraseña
- ✅ **Hash seguro**: Argon2 para passwords
- ✅ **Validación de entrada**: Longitud mínima, campos requeridos
- ✅ **Logout automático**: Si token inválido (401), redirige a login

## Badges de Rol con Colores

| Rol | Label | Color |
|-----|-------|-------|
| visitor | Visitante | Gris (text-tertiary) |
| consumer | Cliente | Azul (info) |
| provider | Proveedor | Verde (success) |
| both | Cliente y Proveedor | Morado (primary) |
| admin | Administrador | Rojo (danger) |

## Estadísticas

- **Servicios Publicados**: Cuenta de servicios del usuario (`/services` filtrado)
- **Contratos Completados**: Contratos con status='completed'
- **Calificación**: Placeholder 5.0 (pendiente implementación de sistema de reviews)

## Mensajes de Error

### Perfil
- "Error al cargar perfil" (fetch error)
- "El nombre debe tener al menos 3 caracteres" (validación)
- "Error al actualizar perfil" / mensaje específico del backend

### Contraseña
- "Las contraseñas no coinciden" (frontend)
- "La nueva contraseña debe tener al menos 8 caracteres" (frontend/backend)
- "Contraseña actual incorrecta" (403 del backend)
- "Error al cambiar contraseña" (genérico)

## Próximas Mejoras

1. **Upload de avatar**: Endpoint POST /users/me/avatar con multer
2. **Validación de website**: Verificar formato URL válida
3. **Validación de teléfono**: Formato específico por país
4. **Sistema de ratings**: Implementar reviews y cálculo de rating real
5. **Confirmación por email**: Al cambiar contraseña enviar notificación
6. **Historial de cambios**: Log de actualizaciones de perfil
7. **Límite de intentos**: Rate limiting en cambio de contraseña

## Testing

### Casos de Prueba
1. ✅ Cargar perfil con token válido
2. ✅ Redirigir a login si no hay token
3. ✅ Editar perfil con datos válidos
4. ✅ Validar nombre mínimo 3 caracteres
5. ✅ Cambiar contraseña con contraseña actual correcta
6. ✅ Rechazar cambio con contraseña actual incorrecta
7. ✅ Validar nueva contraseña mínimo 8 caracteres
8. ✅ Verificar que contraseñas coincidan
9. ✅ Mostrar estadísticas correctamente
10. ✅ Toggle entre vista y edición

### Comandos de Testing Manual
```bash
# Ver perfil
curl -H "Authorization: Bearer <token>" http://localhost:3001/users/me

# Actualizar perfil
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Juan Pérez","phone":"1234567890","city":"Bogotá"}' \
  http://localhost:3001/users/me

# Cambiar contraseña
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"oldpass","new_password":"newpass123"}' \
  http://localhost:3001/users/me/password
```

## Estado Actual
✅ **Completado y funcional**

El servidor está ejecutándose en `http://localhost:3001` y la funcionalidad de perfil está lista para usar.
