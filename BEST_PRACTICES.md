# Guía de Mejores Prácticas - Quetzal Platform

## 🔒 Seguridad en Producción

### Variables de Entorno Requeridas

```env
# NO usar estos valores en producción
JWT_SECRET=<generar-con-crypto.randomBytes(64).toString('hex')>
PGPASSWORD=<contraseña-fuerte-no-predecible>

# Usar secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)
```

### Generar JWT_SECRET Seguro

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 📊 Base de Datos

### Ejecutar Migraciones

```bash
# Ejecutar en orden
psql -U usuario -d quetzal_db -f server/migrations/20251202_000001_contracts.sql
psql -U usuario -d quetzal_db -f server/migrations/20251202_000002_add_indexes.sql
```

### Índices Importantes

- `idx_contracts_buyer_status` - Consultas de contratos por cliente
- `idx_contracts_seller_status` - Consultas de contratos por proveedor  
- `idx_services_category_status` - Búsquedas filtradas
- `idx_services_status_created` - Listados de servicios recientes

### Verificar Índices

```sql
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('contracts', 'services')
ORDER BY tablename, indexname;
```

---

## 🚀 Despliegue

### Checklist Pre-Producción

- [ ] Cambiar `JWT_SECRET` a valor aleatorio fuerte
- [ ] Configurar `NODE_ENV=production`
- [ ] Cambiar credenciales de base de datos
- [ ] Configurar CORS específico (no usar '*')
- [ ] Ejecutar todas las migraciones
- [ ] Configurar límite de rate limiting
- [ ] Configurar HTTPS/SSL
- [ ] Revisar logs de errores

### Variables de Entorno Producción

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<secret-generado-64-chars>
JWT_EXPIRES_IN=86400
PGHOST=<db-host>
PGPORT=5432
PGDATABASE=quetzal_db
PGUSER=<db-user>
PGPASSWORD=<db-password>
CORS_ORIGIN=https://tu-dominio.com
```

---

## 🧪 Testing

### Tests Pendientes

- [ ] Tests unitarios para auth.ts
- [ ] Tests de integración para endpoints de contratos
- [ ] Tests de seguridad para uploads
- [ ] Tests de validación de datos

### Ejecutar Tests (cuando se implementen)

```bash
npm test
npm run test:coverage
```

---

## 📈 Monitoreo

### Logs Importantes

- Errores de autenticación (401/403)
- Errores de base de datos
- Uploads fallidos
- Transiciones de estado de contratos

### Queries a Monitorear

```sql
-- Contratos por estado
SELECT status, COUNT(*) 
FROM contracts 
GROUP BY status;

-- Servicios activos por categoría
SELECT category, COUNT(*) 
FROM services 
WHERE status = 'active' 
GROUP BY category;

-- Contratos creados hoy
SELECT COUNT(*) 
FROM contracts 
WHERE created_at >= CURRENT_DATE;
```

---

## 🔄 Mantenimiento

### Limpieza de Archivos Antiguos

```bash
# Eliminar imágenes de servicios borrados (ejecutar mensualmente)
find web/uploads -type f -mtime +90 -delete
```

### Optimización de DB

```sql
-- Ejecutar semanalmente
VACUUM ANALYZE contracts;
VACUUM ANALYZE services;
```

---

## 📝 Próximas Mejoras

1. **Rate Limiting** - Implementar express-rate-limit
2. **Tests Automatizados** - Jest + Supertest
3. **Logging Estructurado** - Winston con niveles
4. **Validación con Zod** - Schemas compartidos frontend/backend
5. **Optimización de Imágenes** - Sharp para comprimir uploads
6. **WebSockets** - Notificaciones en tiempo real
7. **Caché** - Redis para sesiones y datos frecuentes
8. **CI/CD** - Pipeline automatizado
9. **Backups Automatizados** - Snapshots diarios de BD
10. **Monitoreo** - Sentry o similar para tracking de errores

---

## 🐛 Troubleshooting

### Token Inválido

```javascript
// Limpiar localStorage en navegador
localStorage.clear();
location.reload();
```

### Errores de CORS

- Verificar `CORS_ORIGIN` en .env
- Comprobar que el frontend use el mismo puerto configurado

### Contratos no se actualizan

- Verificar que el servidor esté corriendo
- Revisar logs del servidor para errores
- Comprobar que el token no haya expirado (dura 24 horas)

---

## 📞 Soporte

Para reportar bugs o solicitar features, crear issue en el repositorio.
