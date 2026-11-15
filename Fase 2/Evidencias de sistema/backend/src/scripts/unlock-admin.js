// Desbloquea una cuenta admin (limpia failedLoginCount y lockedUntil).
// Uso: npm run admin:unlock -- admin@aprueba.cl [--real]
import 'dotenv/config';
import { db, COL } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';
assertSafeTarget('unlock-admin');
const email = process.argv[2];
if (!email || email.startsWith('--')) { console.error('Uso: npm run admin:unlock -- correo [--real]'); process.exit(1); }
const snap = await db.collection(COL.adminUsers).where('emailLower', '==', email.toLowerCase()).limit(1).get();
if (snap.empty) { console.error('No existe ese admin.'); process.exit(1); }
await snap.docs[0].ref.set({ failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() }, { merge: true });
console.log(`Cuenta ${email} desbloqueada.`);
process.exit(0);
