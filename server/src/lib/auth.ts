import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import argon2 from 'argon2';

/**
 * Hashear contraseña con Argon2
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

/**
 * Verificar una contraseña contra un hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

/**
 * Generar token JWT de acceso
 */
export function signAccessToken(
  payload: Record<string, any>,
  expiresIn?: string | number
): string {
  const secret: string = process.env.JWT_SECRET ?? 'dev-secret';

  // Convertimos a un tipo que TS acepte seguro
  const exp = (expiresIn ??
    process.env.JWT_EXPIRES_IN ??
    "1d") as SignOptions["expiresIn"];

  const opts: SignOptions = { expiresIn: exp };

  return jwt.sign(payload, secret, opts);
}

/**
 * Verificar un token JWT
 */
export function verifyToken(token: string): string | JwtPayload {
  const secret: string = process.env.JWT_SECRET ?? 'dev-secret';
  return jwt.verify(token, secret);
}
