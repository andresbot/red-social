import jwt from 'jsonwebtoken';
import argon2 from 'argon2';

export async function hashPassword(password: string) {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export function signAccessToken(payload: object, expiresIn?: string | number) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  // Convertir a número si viene del .env (segundos)
  const expires = expiresIn || parseInt(process.env.JWT_EXPIRES_IN || '86400', 10);
  return jwt.sign(payload, secret, { expiresIn: expires });
}

export function verifyToken(token: string) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return jwt.verify(token, secret);
}
