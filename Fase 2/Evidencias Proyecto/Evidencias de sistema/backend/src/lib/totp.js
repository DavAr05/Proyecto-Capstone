// TOTP (RFC 6238) con SHA-1, 6 dígitos, paso de 30 s. Solo usa node:crypto.
import crypto from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;

export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  let bits = 0, value = 0; const out = [];
  for (const ch of String(str).toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const generateSecret = () => base32Encode(crypto.randomBytes(20));

export function hotp(secretB32, counter, digits = 6) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secretB32)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
}

export const totpStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / STEP);
export const totp = (secretB32, nowMs = Date.now()) => hotp(secretB32, totpStep(nowMs));

/** Verifica con ventana ±1 paso. Devuelve el paso aceptado o null. */
export function verifyTotp(secretB32, token, { nowMs = Date.now(), window = 1, lastStep = null } = {}) {
  const t = String(token ?? '').trim();
  if (!/^\d{6}$/.test(t) || !secretB32) return null;
  const cur = totpStep(nowMs);
  for (let d = -window; d <= window; d += 1) {
    const step = cur + d;
    if (lastStep != null && step <= lastStep) continue; // anti-replay
    const exp = Buffer.from(hotp(secretB32, step));
    if (crypto.timingSafeEqual(exp, Buffer.from(t))) return step;
  }
  return null;
}

export const otpauthUri = (secretB32, account, issuer = 'Aprueba Admin') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
