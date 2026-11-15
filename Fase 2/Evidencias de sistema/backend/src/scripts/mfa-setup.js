// Configura/rota la contraseña y el secreto TOTP de un admin.
// Uso: npm run mfa:setup -- admin@aprueba.cl [--password NUEVA] [--real]
// Imprime el secreto y el otpauth UNA vez (escanéalo en Google Authenticator/Authy).
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, COL } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';
import { generateSecret, otpauthUri } from '../lib/totp.js';

assertSafeTarget('mfa-setup');
const email = process.argv[2];
if (!email || email.startsWith('--')) { console.error('Uso: npm run mfa:setup -- correo [--password NUEVA] [--real]'); process.exit(1); }
const pi = process.argv.indexOf('--password');
const snap = await db.collection(COL.adminUsers).where('emailLower', '==', email.toLowerCase()).limit(1).get();
if (snap.empty) { console.error('No existe ese admin.'); process.exit(1); }
const secret = generateSecret();
const patch = { mfaEnabled: true, mfaSecret: secret, lastTotpStep: null, updatedAt: new Date() };
if (pi > 0 && process.argv[pi + 1]) patch.passwordHash = bcrypt.hashSync(process.argv[pi + 1], 12);
await snap.docs[0].ref.set(patch, { merge: true });
console.log(`MFA configurado para ${email}${patch.passwordHash ? ' (contraseña rotada)' : ''}`);
console.log('Secreto :', secret);
console.log('otpauth :', otpauthUri(secret, email));
process.exit(0);
