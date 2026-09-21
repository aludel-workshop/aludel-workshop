import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function openSecretStore(dataDirectory) {
  const keyPath = join(dataDirectory, 'integration-vault.key');
  if (!existsSync(keyPath)) {
    writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: 'wx' });
    try { chmodSync(keyPath, 0o600); } catch { /* Windows ACLs are outside this local adapter. */ }
  }
  const key = readFileSync(keyPath);
  if (key.length !== 32) throw new Error('The local integration vault key is invalid.');
  return {
    seal(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
    },
    open(value) {
      const payload = Buffer.from(value, 'base64url');
      if (payload.length < 29) throw new Error('The encrypted integration credential is invalid.');
      const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
      decipher.setAuthTag(payload.subarray(12, 28));
      return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
    }
  };
}
