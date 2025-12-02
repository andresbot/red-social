#!/usr/bin/env node

/**
 * Script de utilidades para generar valores seguros
 * Uso: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

console.log('\n🔐 Generador de Secrets Seguros\n');
console.log('='.repeat(50));

// Generar JWT Secret
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('\n✅ JWT_SECRET generado:');
console.log(jwtSecret);

// Generar Session Secret
const sessionSecret = crypto.randomBytes(32).toString('hex');
console.log('\n✅ SESSION_SECRET generado:');
console.log(sessionSecret);

// Generar API Key
const apiKey = crypto.randomBytes(24).toString('base64url');
console.log('\n✅ API_KEY generado:');
console.log(apiKey);

// Generar Password fuerte
const password = crypto.randomBytes(16).toString('base64url');
console.log('\n✅ PASSWORD sugerido:');
console.log(password);

console.log('\n' + '='.repeat(50));
console.log('\n💡 Copia estos valores a tu archivo .env');
console.log('⚠️  NUNCA los compartas o commitees a git\n');
