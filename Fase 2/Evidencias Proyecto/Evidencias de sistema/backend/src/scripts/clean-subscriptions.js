// Deja la demo sin rastro de suscripciones: borra subscriptions, payments y checkoutSessions,
// devuelve a cada alumno a su plan original del seed y, si hay clave sk_test_, cancela las
// suscripciones y borra los clientes de PRUEBA que se hayan creado en Stripe.
// Uso: npm run subs:clean -- --real            (solo muestra qué haría)
//      npm run subs:clean -- --real --yes      (lo ejecuta)
// No toca canjes, preguntas respondidas, tickets ni saldos de medallas.
import 'dotenv/config';
import { db, COL, FieldValue } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';
assertSafeTarget('clean-subscriptions');

const APPLY = process.argv.includes('--yes');
const KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE = /^sk_test_/.test(KEY);

// Plan original de cada alumno según backend/src/seed/seed.js
const SEED_PLAN = {
  usr_1: { plan: 'all', planStatus: 'active', planSource: 'subscription', stripeCustomerId: 'cus_QaBcDeFgHi' },
  usr_2: { plan: 'uni', planStatus: 'active', planSource: 'subscription', stripeCustomerId: 'cus_JlKmNoPqRs' },
  usr_3: { plan: 'free', planStatus: 'none', planSource: 'free', stripeCustomerId: null },
  usr_4: { plan: 'free', planStatus: 'none', planSource: 'free', stripeCustomerId: null },
  usr_5: { plan: 'all', planStatus: 'active', planSource: 'subscription', stripeCustomerId: 'cus_MvNbXcVbNm' },
  usr_6: { plan: 'uni', planStatus: 'canceled', planSource: 'subscription', stripeCustomerId: null },
};
const FREE = { plan: 'free', planStatus: 'none', planSource: 'free', stripeCustomerId: null };

async function stripe(method, path) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, { method, headers: { Authorization: `Bearer ${KEY}` } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
}

const [subs, pays, sess, users] = await Promise.all([
  db.collection(COL.subscriptions).get(), db.collection(COL.payments).get(),
  db.collection(COL.checkoutSessions).get(), db.collection(COL.users).get(),
]);
const touched = users.docs.filter((d) => d.data().subscriptionId || d.data().planExpiresAt !== undefined
  || subs.docs.some((s) => s.data().userId === d.id));
const stripeSubs = [...new Set(subs.docs.map((s) => s.data().stripeSubscriptionId).filter((x) => x && x.startsWith('sub_') && !x.startsWith('sub_mock')))];
const stripeCus = [...new Set(subs.docs.map((s) => s.data().stripeCustomerId).filter((x) => x && x.startsWith('cus_') && !x.startsWith('cus_mock')))];

console.log(`${APPLY ? 'EJECUTANDO' : 'SIMULACRO (agrega --yes para ejecutar)'}:`);
console.log(`  subscriptions: ${subs.size} · payments: ${pays.size} · checkoutSessions: ${sess.size}`);
console.log(`  alumnos a restaurar: ${touched.map((d) => d.id).join(', ') || 'ninguno'}`);
console.log(`  Stripe de prueba: ${STRIPE ? `${stripeSubs.length} suscripciones y ${stripeCus.length} clientes` : 'sin clave sk_test_, no se toca'}`);
if (!APPLY) process.exit(0);

// 1) Stripe (primero cancelar suscripciones y luego borrar clientes)
if (STRIPE) {
  for (const id of stripeSubs) { const r = await stripe('DELETE', `/subscriptions/${id}`); console.log(`  Stripe sub ${id}: ${r.ok ? 'cancelada' : (r.body?.error?.message || r.status)}`); }
  for (const id of stripeCus) { const r = await stripe('DELETE', `/customers/${id}`); console.log(`  Stripe cus ${id}: ${r.ok ? 'borrado' : (r.body?.error?.message || r.status)}`); }
}

// 2) Alumnos de vuelta a su plan original
for (const d of touched) {
  const base = SEED_PLAN[d.id] || FREE;
  await d.ref.set({ ...base, subscriptionId: FieldValue.delete(), planExpiresAt: FieldValue.delete(), updatedAt: new Date().toISOString() }, { merge: true });
}

// 3) Colecciones de suscripciones
for (const snap of [subs, pays, sess]) {
  let batch = db.batch(); let n = 0;
  for (const d of snap.docs) { batch.delete(d.ref); n += 1; if (n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
  await batch.commit();
}
console.log('Listo: sin suscripciones, pagos ni sesiones de pago.');
process.exit(0);
