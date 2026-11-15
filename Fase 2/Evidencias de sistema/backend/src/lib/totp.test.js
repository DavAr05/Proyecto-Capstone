// node src/lib/totp.test.js  — vectores RFC 6238 (secreto "12345678901234567890")
import assert from 'node:assert/strict';
import { base32Encode, hotp, verifyTotp, generateSecret, totp } from './totp.js';
const s = base32Encode(Buffer.from('12345678901234567890'));
const v = { 59: '287082', 1111111109: '081804', 1111111111: '050471', 1234567890: '005924', 2000000000: '279037' };
for (const [t, code] of Object.entries(v)) assert.equal(hotp(s, Math.floor(Number(t) / 30)), code, `t=${t}`);
assert.equal(verifyTotp(s, '287082', { nowMs: 59000 }), 1);
assert.equal(verifyTotp(s, '287082', { nowMs: 59000, lastStep: 1 }), null, 'replay');
assert.equal(verifyTotp(s, '000000', { nowMs: 59000 }), null);
assert.equal(verifyTotp(s, 'abc', { nowMs: 59000 }), null);
const g = generateSecret(); assert.equal(verifyTotp(g, totp(g)) !== null, true);
console.log('totp OK');
