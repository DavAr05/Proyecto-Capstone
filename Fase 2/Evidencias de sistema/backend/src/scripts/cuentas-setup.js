// Prepara las 4 cuentas admin (Firestore real o emulador), de forma idempotente:
// desbloquea, fija contraseña y, para admin/finance, deja un secreto TOTP.
// Las credenciales se guardan en backend/.admin-credentials.json (y un .txt legible), ambos ignorados por git.
// Si el archivo ya existe se REUTILIZAN los valores: el celular se enrola una sola vez.
import 'dotenv/config';
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, COL } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';
import { generateSecret, otpauthUri } from '../lib/totp.js';

assertSafeTarget('cuentas-setup');
const JSON_F = new URL('../../.admin-credentials.json', import.meta.url);
const TXT_F = new URL('../../CREDENCIALES_ADMIN.txt', import.meta.url);
let creds = {};
try { creds = JSON.parse(fs.readFileSync(JSON_F, 'utf8')); } catch { /* primera vez */ }

const users = [
  ['admin@aprueba.cl', true], ['finance@aprueba.cl', true],
  ['ops@aprueba.cl', false], ['support@aprueba.cl', false],
];
for (const [email, mfa] of users) {
  const snap = await db.collection(COL.adminUsers).where('emailLower', '==', email).limit(1).get();
  if (snap.empty) { console.error(`Falta ${email}: corre primero el seed (npm run seed -- --real).`); process.exit(1); }
  const c = creds[email] ||= {};
  c.password ||= crypto.randomBytes(6).toString('base64url');
  if (mfa) c.mfaSecret ||= generateSecret();
  const patch = {
    passwordHash: bcrypt.hashSync(c.password, 12), failedLoginCount: 0, lockedUntil: null,
    active: true, mfaEnabled: mfa, mfaSecret: mfa ? c.mfaSecret : null, lastTotpStep: null, updatedAt: new Date(),
  };
  await snap.docs[0].ref.set(patch, { merge: true });
  if (mfa) c.otpauth = otpauthUri(c.mfaSecret, email);
}
fs.writeFileSync(JSON_F, JSON.stringify(creds, null, 2));
const lines = ['CREDENCIALES DE LAS CUENTAS ADMIN (no subir a git)', ''];
for (const [email, mfa] of users) {
  lines.push(`${email}`, `  Contraseña: ${creds[email].password}`);
  if (mfa) lines.push(`  Clave MFA (pegar en Google Authenticator > "Ingresar clave de configuración"): ${creds[email].mfaSecret}`);
  lines.push('');
}
lines.push('Si no tienes el celular a mano: ejecuta codigo_mfa.bat para ver el código actual.');
fs.writeFileSync(TXT_F, lines.join('\r\n'));
console.log('Listo. Cuentas desbloqueadas y credenciales en CREDENCIALES_ADMIN.txt');
process.exit(0);
