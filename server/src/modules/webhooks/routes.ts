/**
 * Webhooks Module
 * 
 * Endpoints para recibir notificaciones de servicios externos (ePayco, etc.)
 * PLACEHOLDER: Implementación real pendiente para producción
 */

import { Router } from 'express';
import type { EpaycoWebhookPayload } from '../../lib/epayco-config.js';
import { validateEpaycoSignature, EPAYCO_STATE_MAP } from '../../lib/epayco-config.js';
import { pool } from '../../lib/db.js';
import { getUserQZAccount, getPlatformQZAccount, createLedgerTransaction, postEntries } from '../../lib/ledger.js';

const router = Router();

// Logger simple para webhooks
const log = {
  info: (msg: string, data?: any) => console.log('[INFO]', msg, data || ''),
  error: (msg: string, data?: any) => console.error('[ERROR]', msg, data || ''),
};

/**
 * POST /webhooks/epayco
 * 
 * Recibe confirmación de pago desde ePayco
 * 
 * IMPORTANTE: Este endpoint NO requiere autenticación JWT (es llamado por ePayco)
 * pero DEBE validar la firma HMAC para seguridad
 * 
 * TODO para producción:
 * - Implementar validateEpaycoSignature() real
 * - Agregar rate limiting específico para este endpoint
 * - Implementar idempotencia (guardar x_ref_payco, evitar duplicados)
 * - Logs detallados para auditoría
 * - Alertas en caso de firmas inválidas (posible ataque)
 */
router.post('/epayco', async (req, res) => {
  const payload = req.body as EpaycoWebhookPayload;
  
  log.info('[Webhook ePayco] Recibido', {
    invoice: payload.x_id_invoice,
    refPayco: payload.x_ref_payco,
    state: payload.x_transaction_state,
    amount: payload.x_amount,
    test: payload.x_test_request,
  });

  try {
    // PASO 1: Validar firma (TODO: implementar validación real)
    const isValid = validateEpaycoSignature(payload, payload.x_signature);
    if (!isValid) {
      log.error('[Webhook ePayco] Firma inválida', { payload });
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // PASO 2: Verificar idempotencia (evitar procesar el mismo pago dos veces)
    const transactionId = parseInt(payload.x_id_invoice, 10);
    if (isNaN(transactionId)) {
      log.error('[Webhook ePayco] Invoice ID inválido', { invoice: payload.x_id_invoice });
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const checkQuery = `
      SELECT id, status, payment_reference, user_id, amount_qz_halves
      FROM transactions 
      WHERE id = $1
    `;
    const checkResult = await pool.query(checkQuery, [transactionId]);
    
    if (checkResult.rows.length === 0) {
      log.error('[Webhook ePayco] Transacción no encontrada', { transactionId });
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = checkResult.rows[0];
    
    // Si ya fue procesada y completada, retornar 200 (idempotencia)
    if (transaction.status === 'completed' && transaction.payment_reference === payload.x_ref_payco) {
      log.info('[Webhook ePayco] Transacción ya procesada (idempotente)', { transactionId });
      return res.status(200).json({ message: 'Already processed' });
    }

    // PASO 3: Mapear estado de ePayco a nuestro estado interno
    const internalState = EPAYCO_STATE_MAP[payload.x_transaction_state] || 'failed';

    // PASO 4: Actualizar transacción con datos de ePayco
    const updateQuery = `
      UPDATE transactions
      SET 
        status = $1,
        payment_reference = $2,
        authorization_code = $3,
        processed_at = NOW(),
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{epayco}',
          $4::jsonb
        )
      WHERE id = $5
      RETURNING *
    `;
    
    const metadata = {
      ref_payco: payload.x_ref_payco,
      transaction_id: payload.x_transaction_id,
      type_payment: payload.x_type_payment,
      bank_name: payload.x_bank_name,
      franchise: payload.x_franchise,
      response: payload.x_response,
      test: payload.x_test_request,
    };

    const updateResult = await pool.query(updateQuery, [
      internalState,
      payload.x_ref_payco,
      payload.x_approval_code || null,
      JSON.stringify(metadata),
      transactionId,
    ]);

    const updatedTransaction = updateResult.rows[0];

    // PASO 5: Si el pago fue aceptado, acreditar QZ al usuario (Ledger)
    if (internalState === 'completed') {
      try {
        // Obtener IDs de cuentas del ledger (retornan string ID)
        const platformAccountId = await getPlatformQZAccount();
        const userAccountId = await getUserQZAccount(String(updatedTransaction.user_id));

        // Crear transacción en el ledger
        const ledgerTxId = await createLedgerTransaction(
          'top_up',
          `Recarga QZ vía ePayco (${payload.x_ref_payco})`
        );

        // Transferir QZ: platform (credit) -> user (debit)
        await postEntries(ledgerTxId, [
          { accountId: platformAccountId, direction: 'credit', amountUnits: updatedTransaction.amount_qz_halves },
          { accountId: userAccountId, direction: 'debit', amountUnits: updatedTransaction.amount_qz_halves },
        ]);

        log.info('[Webhook ePayco] QZ acreditados', {
          transactionId,
          userId: updatedTransaction.user_id,
          amountQZ: updatedTransaction.amount_qz_halves / 2,
        });

        // TODO: Enviar notificación al usuario
        // await notifyUser(updatedTransaction.user_id, 'payment_completed', { amount: ... });

      } catch (ledgerError) {
        log.error('[Webhook ePayco] Error al acreditar QZ', { error: ledgerError, transactionId });
        throw ledgerError;
      }
    }

    log.info('[Webhook ePayco] Procesado exitosamente', {
      transactionId,
      state: internalState,
      refPayco: payload.x_ref_payco,
    });

    // Responder a ePayco (200 OK para confirmar recepción)
    res.status(200).json({ message: 'Webhook processed successfully' });

  } catch (error) {
    log.error('[Webhook ePayco] Error al procesar', { error, payload });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /webhooks/health
 * 
 * Health check para verificar que el endpoint está accesible
 * Útil para configurar en dashboard de ePayco o monitoreo
 */
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'Webhooks module ready',
    timestamp: new Date().toISOString(),
  });
});

export default router;
