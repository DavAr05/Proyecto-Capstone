// Fija el saldo de platino de UN alumno (para la demo de canje), sin re-seed.
// Uso: npm run student:saldo -- usr_1 500 [--real]
import 'dotenv/config';
import { db, COL } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';
assertSafeTarget('student-saldo');

const [id, raw] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const target = Number(raw);
if (!id || !Number.isSafeInteger(target) || target < 0 || target > 100000) {
  console.error('Uso: npm run student:saldo -- <idAlumno> <platino 0-100000> [--real]');
  process.exit(1);
}
const ref = db.collection(COL.users).doc(id);
const snap = await ref.get();
if (!snap.exists) { console.error(`No existe el alumno ${id}.`); process.exit(1); }
const u = snap.data();
const before = Number(u.medals?.platinum) || 0;
const now = new Date().toISOString();
await ref.set({ medals: { bronze: 0, silver: 0, gold: 0, diamond: 0, ...(u.medals || {}), platinum: target }, updatedAt: now }, { merge: true });
await ref.collection('medalLedger').doc().set({
  event: 'adjust', tier: 'platinum', amount: target - before, reason: 'demo_balance_set',
  refType: 'script', refId: 'student-saldo', by: 'script', createdAt: now,
});
console.log(`${u.name} (${id}): platino ${before} -> ${target}`);
process.exit(0);
