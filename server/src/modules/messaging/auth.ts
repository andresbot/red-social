import jwt from 'jsonwebtoken';

export const verifySocketToken = (token: string): { userId: string } | null => {
  try {
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return payload;
  } catch (err) {
    console.error('Socket auth error:', err);
    return null;
  }
};