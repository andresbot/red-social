# 🚀 Guía de Despliegue - Quetzal Platform

## Pre-requisitos

- Node.js 18+ instalado
- PostgreSQL 14+ instalado y corriendo
- Git instalado

---

## 🔧 Configuración Inicial

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd quetzal
```

### 2. Configurar Backend

```bash
cd server
npm install

# Copiar archivo de configuración
cp .env.example .env

# Generar secrets seguros
node scripts/generate-secrets.js

# Editar .env con los valores generados y tu configuración de BD
nano .env  # o usar cualquier editor
```

### 3. Configurar Base de Datos

```bash
# Crear base de datos
createdb quetzal_db

# Ejecutar schema principal
psql -U postgres -d quetzal_db -f ../script.md

# Ejecutar migraciones adicionales
psql -U postgres -d quetzal_db -f migrations/20251202_000002_add_indexes.sql
```

### 4. Iniciar Servidor

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

---

## 🌐 Despliegue en Producción

### Opción 1: VPS (DigitalOcean, Linode, etc.)

```bash
# 1. Conectar al servidor
ssh user@your-server-ip

# 2. Instalar dependencias
sudo apt update
sudo apt install nodejs npm postgresql nginx

# 3. Clonar proyecto
git clone <repository-url> /var/www/quetzal
cd /var/www/quetzal/server

# 4. Instalar dependencias
npm install --production

# 5. Configurar .env con valores de producción
nano .env

# 6. Configurar PM2 para mantener el servidor corriendo
npm install -g pm2
pm2 start dist/app.js --name quetzal
pm2 save
pm2 startup
```

### Opción 2: Docker

```bash
# TODO: Agregar Dockerfile y docker-compose.yml
```

### Opción 3: Heroku

```bash
# TODO: Agregar instrucciones para Heroku
```

---

## 🔒 Checklist de Seguridad Producción

- [ ] JWT_SECRET generado con crypto.randomBytes
- [ ] NODE_ENV=production
- [ ] Credenciales de BD seguras y no predecibles
- [ ] CORS configurado con dominio específico (no '*')
- [ ] HTTPS/SSL configurado
- [ ] Rate limiting activado
- [ ] Logs configurados
- [ ] Backups automáticos de BD configurados
- [ ] Archivos .env NO commiteados a git
- [ ] Variables sensibles en secrets manager

---

## 📊 Monitoreo Post-Despliegue

### Verificar que todo funciona

```bash
# Health check
curl http://your-domain.com/health

# Verificar logs
pm2 logs quetzal

# Ver procesos
pm2 status
```

### Queries útiles de monitoreo

```sql
-- Total de usuarios
SELECT COUNT(*) FROM users;

-- Servicios activos
SELECT COUNT(*) FROM services WHERE status = 'active';

-- Contratos por estado
SELECT status, COUNT(*) FROM contracts GROUP BY status;

-- Últimos 10 contratos
SELECT * FROM contracts ORDER BY created_at DESC LIMIT 10;
```

---

## 🐛 Solución de Problemas

### El servidor no inicia

```bash
# Verificar logs
pm2 logs quetzal --lines 100

# Verificar puerto no esté en uso
lsof -i :3000

# Verificar conexión a BD
psql -U <user> -d quetzal_db -c "SELECT 1"
```

### Errores de autenticación

```bash
# Verificar que JWT_SECRET esté configurado
echo $JWT_SECRET

# Verificar que sea el mismo en .env
cat .env | grep JWT_SECRET
```

### Problemas de CORS

```bash
# Verificar CORS_ORIGIN en .env
cat .env | grep CORS_ORIGIN

# Debe coincidir con el dominio del frontend
```

---

## 🔄 Actualizaciones

```bash
# 1. Detener servidor
pm2 stop quetzal

# 2. Pull cambios
git pull origin main

# 3. Instalar nuevas dependencias
npm install

# 4. Ejecutar nuevas migraciones (si hay)
psql -U postgres -d quetzal_db -f migrations/nueva_migracion.sql

# 5. Rebuild
npm run build

# 6. Reiniciar servidor
pm2 restart quetzal
```

---

## 📈 Optimización

### Para alto tráfico

1. **Usar PM2 en modo cluster**
   ```bash
   pm2 start dist/app.js -i max --name quetzal
   ```

2. **Configurar Nginx como proxy inverso**
   ```nginx
   upstream quetzal_backend {
    server 127.0.0.1:3000;
   }
   
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://quetzal_backend;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Agregar Redis para caché**
   ```bash
   # TODO: Implementar Redis
   ```

---

## 📞 Soporte

Para problemas de despliegue, crear issue en el repositorio con:
- Sistema operativo
- Versión de Node.js
- Logs de error completos
- Pasos para reproducir
