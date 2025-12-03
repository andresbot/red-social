# Integración con ePayco - Guía de Implementación

**Estado actual:** PLACEHOLDER - Las bases están preparadas pero la integración real está pendiente.

## 📋 Tabla de Contenidos

1. [Resumen](#resumen)
2. [Estado Actual](#estado-actual)
3. [Requisitos Previos](#requisitos-previos)
4. [Flujo de Integración](#flujo-de-integración)
5. [Configuración](#configuración)
6. [Implementación Frontend](#implementación-frontend)
7. [Testing](#testing)
8. [Producción](#producción)
9. [Troubleshooting](#troubleshooting)

---

## Resumen

ePayco es la pasarela de pagos para compra de Quetzales (QZ) con pesos colombianos (COP).

**Conversión:** 1 QZ = $10.000 COP (configurable vía `EXCHANGE_RATE_COP_PER_QZ`)

---

## Estado Actual

### ✅ Implementado (Bases)

- `server/src/lib/epayco-config.ts`: Tipos, interfaces, funciones placeholder
- `server/src/modules/webhooks/routes.ts`: Endpoint `POST /webhooks/epayco` (sin validación real de firma)
- Sistema mock: `POST /payments/purchase` + `POST /payments/mock-confirm` para desarrollo
- Base de datos: Tabla `transactions` con campos `payment_reference`, `authorization_code`

### ❌ Pendiente

- Credenciales reales de ePayco (public_key, private_key)
- Validación HMAC de firma en webhook
- Script de checkout en frontend
- Configuración de webhook en dashboard de ePayco
- Testing con tarjetas de prueba en sandbox
- Logs detallados y alertas de seguridad
- Rate limiting específico para webhook

---

## Requisitos Previos

### 1. Cuenta ePayco

1. Crear cuenta en [ePayco](https://dashboard.epayco.co/)
2. Activar cuenta (verificación de identidad y documentos)
3. Obtener credenciales:
   - **Public Key** (p_cust_xxxxx)
   - **Private Key** (secreto)

### 2. Configurar Webhook

En el dashboard de ePayco:

1. Ir a **Configuración → Webhooks**
2. Agregar URL: `https://tudominio.com/api/webhooks/epayco`
3. Seleccionar eventos: "Confirmación de pago"
4. Guardar

**Nota:** Para desarrollo local, usar [ngrok](https://ngrok.com/) o similar:

```bash
ngrok http 3000
# Usar la URL generada: https://xxxx.ngrok.io/api/webhooks/epayco
```

---

## Flujo de Integración

### Diagrama de Secuencia

```
Usuario → Frontend → Backend → ePayco → Webhook → Backend → Usuario
   │         │          │          │         │         │         │
   │ Click   │          │          │         │         │         │
   │ Recargar│          │          │         │         │         │
   ├────────►│          │          │         │         │         │
   │         │ POST     │          │         │         │         │
   │         │ /payments│          │         │         │         │
   │         │ /purchase│          │         │         │         │
   │         ├─────────►│          │         │         │         │
   │         │          │ Crea tx  │         │         │         │
   │         │          │ (pending)│         │         │         │
   │         │          ├──────────┤         │         │         │
   │         │          │ Retorna  │         │         │         │
   │         │◄─────────┤ checkout │         │         │         │
   │         │          │ data     │         │         │         │
   │         │          │          │         │         │         │
   │         │ Abre     │          │         │         │         │
   │◄────────┤ checkout │          │         │         │         │
   │         │ ePayco   │          │         │         │         │
   │         │ (popup)  │          │         │         │         │
   │         │          │          │         │         │         │
   │ Ingresa │          │          │         │         │         │
   │ tarjeta │          │          │         │         │         │
   ├─────────┼──────────┼──────────►         │         │         │
   │         │          │          │ Procesa │         │         │
   │         │          │          │ pago    │         │         │
   │         │          │          ├─────────┤         │         │
   │         │          │          │ Envía   │         │         │
   │         │          │          │ webhook │         │         │
   │         │          │          ├─────────┼────────►│         │
   │         │          │          │         │ Valida  │         │
   │         │          │          │         │ firma   │         │
   │         │          │          │         ├─────────┤         │
   │         │          │          │         │ Acredita│         │
   │         │          │          │         │ QZ      │         │
   │         │          │          │         │ (Ledger)│         │
   │         │          │          │         ├─────────┤         │
   │         │          │          │         │ 200 OK  │         │
   │         │          │          │◄────────┼─────────┤         │
   │         │          │          │         │         │         │
   │         │          │          │ Redirige│         │         │
   │◄────────┼──────────┼──────────┤ a       │         │         │
   │         │          │          │ response│         │         │
   │         │          │          │ URL     │         │         │
   │         │          │          │         │         │         │
   │ Muestra │          │          │         │         │         │
   │ saldo   │          │          │         │         │         │
   │ actualiz│          │          │         │         │         │
   │◄────────┼──────────┼──────────┼─────────┼─────────┼─────────┤
```

---

## Configuración

### Variables de Entorno

Agregar a `server/.env`:

```bash
# ePayco Credentials
EPAYCO_PUBLIC_KEY=p_cust_xxxxxxxxxxxxx
EPAYCO_PRIVATE_KEY=tu_private_key_secreto
EPAYCO_TEST=true  # false en producción

# Base URL para webhooks y response URLs
BASE_URL=https://tudominio.com
# En desarrollo local con ngrok:
# BASE_URL=https://xxxx.ngrok.io

# Tasa de cambio (opcional, default 10000)
EXCHANGE_RATE_COP_PER_QZ=10000
```

### Activar Configuración

Editar `server/src/lib/epayco-config.ts`:

1. Descomentar función `validateEpaycoSignature()` (línea ~79)
2. Implementar HMAC-SHA256:

```typescript
import crypto from 'crypto';

export function validateEpaycoSignature(payload: EpaycoWebhookPayload, signature: string): boolean {
  const secret = process.env.EPAYCO_PRIVATE_KEY;
  if (!secret) throw new Error('EPAYCO_PRIVATE_KEY no configurado');
  
  // Formato según docs de ePayco
  const dataToSign = `${payload.x_cust_id_cliente}^${payload.x_ref_payco}^${payload.x_id_invoice}^${payload.x_amount}`;
  const hash = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
  
  return hash === signature;
}
```

3. Actualizar `prepareCheckoutData()` si es necesario (línea ~92)

---

## Implementación Frontend

### 1. Incluir Script de ePayco

En `web/vistas/cartera.html` (antes de cerrar `</body>`):

```html
<script src="https://checkout.epayco.co/checkout.js"></script>
<script type="module" src="/js/cartera.js"></script>
```

### 2. Actualizar `web/js/cartera.js`

Reemplazar la función `handleTopUp()`:

```javascript
async function handleTopUp() {
  const amount = parseFloat(topupAmountInput.value);
  if (isNaN(amount) || amount < 0.5) {
    showMessage('Mínimo 0.5 QZ', 'error');
    return;
  }

  try {
    topupBtn.disabled = true;
    showMessage('Preparando pago...', 'info');

    // 1. Crear transacción en backend
    const response = await api.post('/payments/purchase', { amount_qz: amount });
    const { transaction, checkout_data } = response;

    if (!checkout_data) {
      // Modo dev: usar mock-confirm
      await api.post('/payments/mock-confirm', { transaction_id: transaction.id });
      showMessage('Recarga exitosa (modo dev)', 'success');
      await loadBalance();
      await loadTransactions();
      return;
    }

    // 2. Configurar checkout de ePayco
    const handler = ePayco.checkout.configure({
      key: checkout_data.public_key, // Backend debe incluir esto
      test: checkout_data.test,
    });

    // 3. Abrir checkout
    const data = {
      name: checkout_data.name,
      description: checkout_data.description,
      currency: 'cop',
      amount: checkout_data.amount,
      tax_base: checkout_data.taxBase,
      tax: checkout_data.tax,
      country: 'co',
      lang: 'es',
      invoice: checkout_data.invoice,
      external: 'false',
      response: checkout_data.response,
      confirmation: checkout_data.confirmation,
      // Prefill user data si está disponible
      name_billing: state.user?.name || '',
      email_billing: state.user?.email || '',
    };

    handler.open(data);

    // El webhook confirmará el pago automáticamente
    showMessage('Complete el pago en la ventana emergente', 'info');

  } catch (error) {
    console.error('Error al recargar:', error);
    showMessage('Error al procesar recarga', 'error');
  } finally {
    topupBtn.disabled = false;
  }
}
```

### 3. Actualizar Backend

Modificar `server/src/modules/payments/routes.ts` para retornar `checkout_data`:

```typescript
import { getEpaycoConfig, prepareCheckoutData } from '../../lib/epayco-config';

router.post('/purchase', requireAuth, async (req, res) => {
  // ... código existente ...

  // Si ePayco está configurado, preparar checkout
  const config = getEpaycoConfig();
  let checkoutData = null;
  
  if (config) {
    checkoutData = prepareCheckoutData(
      insertResult.rows[0].id,
      amountCopCents,
      userId
    );
  }

  res.status(201).json({ 
    transaction: insertResult.rows[0],
    checkout_data: checkoutData ? { ...checkoutData, public_key: config.publicKey, test: config.test } : null,
  });
});
```

---

## Testing

### Sandbox (Modo Prueba)

1. Asegurar `EPAYCO_TEST=true` en `.env`
2. Usar tarjetas de prueba de ePayco:

#### Tarjetas de Prueba

| Franquicia | Número | CVV | Fecha | Resultado |
|------------|--------|-----|-------|-----------|
| Visa | 4575 6231 8229 0326 | 123 | 12/25 | Aprobada |
| Mastercard | 5254 1336 0411 8763 | 123 | 12/25 | Aprobada |
| Visa | 4151 6112 3456 7890 | 123 | 12/25 | Rechazada |

#### PSE (Pruebas)

- Banco: Seleccionar "Banco de Pruebas"
- Tipo: Persona Natural
- Documento: 123456789
- Usuario: prueba
- Clave: prueba

### Verificar Flujo

1. **Frontend:**
   - Click en "Recargar QZ"
   - Se abre popup de ePayco
   - Ingresar tarjeta de prueba
   - Confirmar pago

2. **Backend:**
   - Verificar logs del webhook: `[Webhook ePayco] Recibido`
   - Verificar que transacción pasa a `completed`
   - Verificar que QZ se acreditan en `wallets`

3. **Base de Datos:**
   ```sql
   -- Ver transacciones
   SELECT id, user_id, status, amount_qz_halves, payment_reference, created_at
   FROM transactions
   ORDER BY created_at DESC
   LIMIT 10;

   -- Ver saldo del usuario
   SELECT user_id, balance_qz_halves / 2.0 AS balance_qz
   FROM wallets
   WHERE user_id = 1;

   -- Ver entradas del ledger
   SELECT lt.id, lt.type, lt.description, 
          le.account_id, le.debit_qz_halves, le.credit_qz_halves
   FROM ledger_transactions lt
   JOIN ledger_entries le ON le.ledger_transaction_id = lt.id
   ORDER BY lt.created_at DESC
   LIMIT 20;
   ```

---

## Producción

### Checklist Pre-Lanzamiento

- [ ] Cambiar `EPAYCO_TEST=false`
- [ ] Verificar credenciales de producción (no usar las de sandbox)
- [ ] Configurar webhook con URL pública HTTPS (certificado SSL válido)
- [ ] Implementar validación de firma HMAC
- [ ] Agregar rate limiting al endpoint webhook:
  ```typescript
  import rateLimit from 'express-rate-limit';
  
  const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // Máximo 100 requests por minuto
    message: 'Too many webhook requests',
  });
  
  app.use('/webhooks/epayco', webhookLimiter);
  ```
- [ ] Agregar logs detallados:
  ```typescript
  logger.info('[Webhook ePayco]', {
    refPayco: payload.x_ref_payco,
    state: payload.x_transaction_state,
    amount: payload.x_amount,
    timestamp: new Date().toISOString(),
  });
  ```
- [ ] Configurar alertas para:
  - Firmas inválidas (posibles ataques)
  - Tasas de error elevadas
  - Pagos rechazados frecuentes
- [ ] Testing exhaustivo con montos reales pequeños
- [ ] Backup de base de datos antes de activar
- [ ] Documentar procedimiento de rollback

### Monitoreo

Endpoints útiles:

- `GET /webhooks/health`: Health check
- `GET /wallet/balance`: Verificar saldos
- Logs: Buscar `[Webhook ePayco]` en archivos de log

---

## Troubleshooting

### Webhook no recibe llamadas

1. Verificar URL en dashboard de ePayco
2. Verificar que el servidor esté accesible públicamente (usar `curl` desde exterior)
3. Revisar logs del servidor por errores de conexión
4. Si usas ngrok, asegurar que el túnel esté activo

### Firma inválida (403)

1. Verificar que `EPAYCO_PRIVATE_KEY` sea correcta
2. Revisar formato de `dataToSign` según [docs de ePayco](https://docs.epayco.co/tools/validacion-de-firmas)
3. Logs: Imprimir `dataToSign` y `signature` recibida para debug

### QZ no se acreditan

1. Verificar logs: `[Webhook ePayco] QZ acreditados`
2. Revisar tabla `transactions`: ¿Estado es `completed`?
3. Revisar tabla `ledger_entries`: ¿Se crearon entradas?
4. Revisar `wallets`: ¿Se actualizó el balance?
5. Si hay rollback, revisar logs de error en bloque `try/catch`

### Pagos duplicados

1. Implementar idempotencia basada en `x_ref_payco`
2. En webhook, verificar si `payment_reference` ya existe antes de acreditar
3. Código actual ya incluye check básico (línea 47-51)

### Transacción pendiente (no se confirma)

1. Revisar estado en dashboard de ePayco
2. Verificar que webhook esté configurado correctamente
3. Probar manualmente llamando al webhook con payload de prueba
4. Si persiste, usar endpoint manual de confirmación (admin only):
   ```typescript
   // Endpoint de emergencia (requiere role admin)
   router.post('/payments/admin-confirm/:id', requireAuth, requireRole(['admin']), async (req, res) => {
     const txId = parseInt(req.params.id, 10);
     // Forzar confirmación manual (útil si webhook falló)
     // ... lógica similar a webhook pero sin validar firma
   });
   ```

---

## Recursos

- [Documentación oficial ePayco](https://docs.epayco.co/)
- [Checkout en línea](https://docs.epayco.co/checkout/checkout-en-linea)
- [Validación de firmas](https://docs.epayco.co/tools/validacion-de-firmas)
- [Tarjetas de prueba](https://docs.epayco.co/tools/pruebas)
- [Dashboard ePayco](https://dashboard.epayco.co/)

---

## Contacto Soporte

- ePayco: soporte@epayco.co
- Teléfono: +57 (1) 580 1095

---

**Última actualización:** 2 de diciembre de 2025  
**Próxima revisión:** Al implementar integración real
