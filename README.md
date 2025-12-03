# 🦅 Quetzal Platform

Plataforma de servicios profesionales con sistema de contratos, pagos en moneda virtual (QZ), y gestión completa de transacciones.

## 🎯 Características

### ✅ Implementadas

- **Autenticación JWT** - Login/Register con tokens seguros
- **Gestión de Servicios** - Crear, editar, activar/desactivar servicios
- **Sistema de Contratos** - Flujo completo cliente-proveedor con estados
- **Upload de Imágenes** - Subida de imágenes para servicios (max 2MB)
- **Búsqueda y Filtros** - Buscar servicios por texto y categoría
- **Roles de Usuario** - Consumer, Provider, Both, Admin
- **Auto-refresh** - Actualización automática de contratos cada 30 segundos

### 🚧 En Desarrollo

- Sistema de mensajería (WebSockets configurados)
- Wallet y pagos con ePayco
- Sistema de notificaciones
- Ratings y reviews

---

## 🛠️ Stack Tecnológico

### Backend
- **Node.js 18+** con TypeScript
- **Express.js** - Framework web
- **PostgreSQL** - Base de datos relacional
- **JWT** - Autenticación
- **Argon2** - Hash de contraseñas
- **Multer** - Uploads de archivos
- **Socket.io** - WebSockets (preparado)

### Frontend
- **HTML5 + CSS3** - UI moderna con variables CSS
- **Vanilla JavaScript ES6+** - Sin frameworks
- **Font Awesome** - Iconografía
- **Módulos ES6** - Arquitectura modular

---

## 🚀 Inicio Rápido

### 1. Clonar e Instalar

```bash
git clone <repository-url>
cd quetzal/server
npm install
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example .env
node scripts/generate-secrets.js  # Genera JWT_SECRET seguro
# Editar .env con tus valores
```

### 3. Configurar Base de Datos

```bash
createdb quetzal_db
psql -U postgres -d quetzal_db -f ../script.md
psql -U postgres -d quetzal_db -f migrations/20251202_000002_add_indexes.sql
```

### 4. Iniciar Servidor

```bash
npm run dev  # Desarrollo
# O
npm run build && npm start  # Producción
```

### 5. Abrir en Navegador

```
http://localhost:3000
```

---

## 📁 Estructura del Proyecto

```
quetzal/
├── server/                 # Backend Node.js + TypeScript
│   ├── src/
│   │   ├── app.ts         # Entry point
│   │   ├── lib/           # Utilidades (auth, db)
│   │   ├── middleware/    # Middleware de Express
│   │   └── modules/       # Módulos por feature
│   │       ├── auth/      # Autenticación
│   │       ├── services/  # CRUD de servicios
│   │       ├── contracts/ # Sistema de contratos
│   │       ├── users/     # Gestión de usuarios
│   │       └── messaging/ # Chat (WebSockets)
│   ├── migrations/        # Migraciones de BD
│   ├── scripts/           # Scripts de utilidad
│   └── .env              # Variables de entorno
│
├── web/                   # Frontend estático
│   ├── vistas/           # Páginas HTML
│   ├── css/              # Estilos globales
│   ├── js/               # Módulos JavaScript
│   │   ├── auth.js       # Sistema de autenticación
│   │   ├── api.js        # Cliente HTTP
│   │   ├── contratos.js  # Gestión de contratos
│   │   └── ...
│   └── uploads/          # Imágenes subidas
│
├── BEST_PRACTICES.md     # Guía de mejores prácticas
├── DEPLOYMENT.md         # Guía de despliegue
└── script.md             # Schema completo de BD
```

---

## 🔐 Seguridad

### Implementado

✅ Hashing de contraseñas con Argon2  
✅ JWT con expiración configurable  
✅ Validación de ownership en endpoints  
✅ Parámetros preparados en queries SQL  
✅ CORS configurable  
✅ Límite de tamaño de archivos (2MB)  

### Pendiente para Producción

- [ ] Rate limiting en endpoints de auth
- [ ] Validación de tipos de archivo (solo imágenes)
- [ ] Sanitización de inputs
- [ ] HTTPS/SSL
- [ ] Secrets en manager externo
- [ ] Logs estructurados

Ver `BEST_PRACTICES.md` para más detalles.

---

## 📖 Documentación

- **[BEST_PRACTICES.md](./BEST_PRACTICES.md)** - Mejores prácticas, testing, monitoreo
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Guía completa de despliegue
- **[ROLES.md](./ROLES.md)** - Sistema de roles y permisos

---

## 🧪 Testing

```bash
# TODO: Implementar tests
npm test
npm run test:coverage
```

---

## 📊 Base de Datos

### Tablas Principales

- `users` - Usuarios del sistema
- `services` - Servicios publicados
- `contracts` - Contratos entre clientes y proveedores
- `wallets` - Saldos de usuarios (QZ y COP)
- `transactions` - Historial de transacciones
- `messages` - Chat entre usuarios
- `notifications` - Notificaciones

### Ejecutar Migraciones

```bash
psql -U postgres -d quetzal_db -f server/migrations/archivo.sql
```

---

## 🐛 Troubleshooting

### Token expirado

```javascript
// En consola del navegador
localStorage.clear();
location.reload();
```

### Servidor no inicia

```bash
# Verificar que PostgreSQL esté corriendo
pg_isready

# Verificar puerto disponible
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows
```

### Errores de CORS

Verificar que `CORS_ORIGIN` en `.env` coincida con la URL del frontend.

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crear branch de feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

---

## 📝 Roadmap

### v1.1 (Próximo)
- [ ] Rate limiting
- [ ] Tests automatizados
- [ ] Validación con Zod
- [ ] Optimización de imágenes

### v1.2
- [ ] Sistema de mensajería completo
- [ ] Notificaciones en tiempo real
- [ ] Wallet funcional

### v2.0
- [ ] Integración con ePayco
- [ ] Sistema de ratings
- [ ] Dashboard de admin
- [ ] App móvil

---

## 📄 Licencia

Este proyecto es privado. Todos los derechos reservados.

---

## 👨‍💻 Autor

Desarrollado por [Tu Nombre]

---

## 🙏 Agradecimientos

- PostgreSQL por la robustez de la BD
- Express.js por la simplicidad
- La comunidad de Node.js

---

**Versión:** 1.0.0  
**Última actualización:** Diciembre 2025
