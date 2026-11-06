import crypto from 'node:crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const salt = parts[1]!;
    const originalHash = parts[2]!;
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}
