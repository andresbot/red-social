/**
 * ePayco Configuration
 * 
 * Este archivo prepara la estructura para integración futura con ePayco.
 * Actualmente NO está implementado; usar mock endpoints para desarrollo.
 * 
 * Documentación: https://docs.epayco.co/
 */

export interface EpaycoConfig {
  publicKey: string;
  privateKey: string;
  test: boolean; // true para sandbox, false para producción
  apiUrl: string;
}

export interface EpaycoCheckoutData {
  // Datos del comercio
  name: string; // Nombre del producto/servicio
  description: string;
  currency: 'COP';
  amount: string; // Monto en pesos (ej: "100000.00")
  taxBase: string; // Base gravable
  tax: string; // IVA
  country: 'CO';
  lang: 'es';
  
  // Identificación
  invoice: string; // ID único de la transacción (transaction.id)
  external: 'false' | 'true'; // false para popup, true para redirect
  
  // URLs de respuesta
  response: string; // URL de retorno después del pago
  confirmation: string; // URL del webhook
  
  // Datos opcionales del comprador (pre-relleno)
  nameClient?: string;
  emailClient?: string;
}

export interface EpaycoWebhookPayload {
  // Campos enviados por ePayco en el webhook
  x_cust_id_cliente: string;
  x_ref_payco: string; // Referencia única de ePayco
  x_id_invoice: string; // Nuestro invoice (transaction.id)
  x_transaction_id: string; // ID de transacción ePayco
  x_amount: string; // Monto total
  x_currency_code: 'COP';
  x_transaction_date: string; // ISO timestamp
  x_transaction_state: 'Aceptada' | 'Rechazada' | 'Pendiente' | 'Fallida';
  x_approval_code?: string; // Código de aprobación del banco
  x_response: string; // Mensaje de respuesta
  x_signature: string; // Firma HMAC para validar autenticidad
  x_test_request: 'true' | 'false';
  
  // Datos adicionales
  x_type_payment?: string; // Tipo de pago (PSE, tarjeta, efectivo, etc.)
  x_bank_name?: string;
  x_cardnumber?: string; // Últimos 4 dígitos enmascarados
  x_franchise?: string; // Visa, Mastercard, etc.
}

/**
 * Mapeo de estados de ePayco a nuestros estados internos
 */
export const EPAYCO_STATE_MAP: Record<string, 'pending' | 'completed' | 'failed' | 'refunded'> = {
  'Aceptada': 'completed',
  'Rechazada': 'failed',
  'Pendiente': 'pending',
  'Fallida': 'failed',
};

/**
 * Obtiene configuración de ePayco desde variables de entorno
 * TODO: Implementar cuando se obtengan credenciales reales
 */
export function getEpaycoConfig(): EpaycoConfig | null {
  const publicKey = process.env.EPAYCO_PUBLIC_KEY;
  const privateKey = process.env.EPAYCO_PRIVATE_KEY;
  
  if (!publicKey || !privateKey) {
    return null; // No configurado, usar mock
  }
  
  return {
    publicKey,
    privateKey,
    test: process.env.EPAYCO_TEST === 'true' || process.env.NODE_ENV !== 'production',
    apiUrl: process.env.EPAYCO_TEST === 'true' 
      ? 'https://secure.payco.co/checkout.php' // Sandbox
      : 'https://secure.epayco.co/checkout.php', // Producción
  };
}

/**
 * Valida la firma HMAC del webhook de ePayco
 * 
 * @param payload - Datos recibidos del webhook
 * @param signature - Firma x_signature enviada por ePayco
 * @returns true si la firma es válida
 * 
 * TODO: Implementar validación real cuando se integre ePayco
 * Documentación: https://docs.epayco.co/tools/validacion-de-firmas
 */
export function validateEpaycoSignature(payload: EpaycoWebhookPayload, signature: string): boolean {
  // PLACEHOLDER: Por ahora retorna true en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.warn('[ePayco] Validación de firma deshabilitada en desarrollo');
    return true;
  }
  
  // TODO: Implementar validación HMAC-SHA256
  // const secret = process.env.EPAYCO_PRIVATE_KEY;
  // const dataToSign = `${payload.x_cust_id_cliente}^${payload.x_ref_payco}^${payload.x_id_invoice}^${payload.x_amount}`;
  // const hash = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
  // return hash === signature;
  
  throw new Error('Validación de firma ePayco no implementada');
}

/**
 * Genera datos para checkout de ePayco
 * 
 * @param transactionId - ID de la transacción en nuestra BD
 * @param amountCOP - Monto en pesos colombianos (centavos)
 * @param userId - ID del usuario
 * @returns Datos para inicializar checkout
 * 
 * TODO: Implementar cuando se integre ePayco
 */
export function prepareCheckoutData(
  transactionId: number,
  amountCOP: number,
  userId: number
): EpaycoCheckoutData | null {
  const config = getEpaycoConfig();
  if (!config) return null;
  
  const amount = (amountCOP / 100).toFixed(2); // Centavos a pesos
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  return {
    name: 'Recarga Quetzales (QZ)',
    description: `Recarga de saldo para usuario ${userId}`,
    currency: 'COP',
    amount,
    taxBase: '0', // Sin IVA por ahora
    tax: '0',
    country: 'CO',
    lang: 'es',
    invoice: transactionId.toString(),
    external: 'false', // Usar popup de ePayco
    response: `${baseUrl}/payments/response`, // Página de confirmación en frontend
    confirmation: `${baseUrl}/api/webhooks/epayco`, // Nuestro webhook
  };
}

/**
 * NOTAS DE IMPLEMENTACIÓN (TODO):
 * 
 * 1. Credenciales:
 *    - Obtener public_key y private_key de ePayco (dashboard)
 *    - Configurar en .env: EPAYCO_PUBLIC_KEY, EPAYCO_PRIVATE_KEY, EPAYCO_TEST
 * 
 * 2. Integración frontend:
 *    - Incluir script: <script src="https://checkout.epayco.co/checkout.js"></script>
 *    - Usar ePayco.checkout.configure() con datos de prepareCheckoutData()
 *    - Documentación: https://docs.epayco.co/checkout/checkout-en-linea
 * 
 * 3. Webhook:
 *    - Configurar URL pública en dashboard de ePayco (usar ngrok para local)
 *    - Validar firma HMAC en cada request
 *    - Implementar idempotencia (guardar x_ref_payco y evitar duplicados)
 * 
 * 4. Testing:
 *    - Sandbox: Usar tarjetas de prueba de ePayco
 *    - Visa: 4575623182290326, CVV: 123, Fecha: 12/25
 *    - Documentación: https://docs.epayco.co/tools/pruebas
 * 
 * 5. Producción:
 *    - Cambiar EPAYCO_TEST=false
 *    - Validar certificados SSL
 *    - Configurar rate limiting en webhook
 *    - Agregar logs detallados y alertas
 */
