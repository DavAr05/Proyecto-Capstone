// Suscripciones del alumno (parte de /api/v1/student): ver mi suscripción, iniciar el pago,
// pagar (Stripe real en modo prueba, o Stripe simulado con tarjetas de prueba), cancelar y reanudar.
// Se monta después de studentRequired, así que `req.student` ya existe.
import crypto from 'node:crypto';
import { Router } from 'express';
import { ok, created, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { COL, db, getDoc } from '../data/repo.js';
import { PAID_PLANS, PERIOD_MS, activateSubscription, getSubscription, priceCents, recordFailedPayment, rid } from '../lib/billing.js';
import { createCheckoutSession, retrieveCheckoutSession, setCancelAtPeriodEnd, stripeEnabled, stripeMode } from '../lib/stripe.js';

const r = Router();

// Tarjetas de PRUEBA oficiales de Stripe. En modo simulado no se acepta ninguna otra.
const TEST_CARDS = {
  4242424242424242: { brand: 'visa' },
  4000056655665556: { brand: 'visa' },
  5555555555554444: { brand: 'mastercard' },
  2223003122003222: { brand: 'mastercard' },
  378282246310005: { brand: 'amex' },
  4000000000000002: { brand: 'visa', fail: ['card_declined', 'Tu tarjeta fue rechazada.'] },
  4000000000009995: { brand: 'visa', fail: ['insufficient_funds', 'Tu tarjeta no tiene fondos suficientes.'] },
  4000000000000069: { brand: 'visa', fail: ['expired_card', 'Tu tarjeta ha expirado.'] },
  4000000000000127: { brand: 'visa', fail: ['incorrect_cvc', 'El código de seguridad (CVC) de tu tarjeta es incorrecto.'] },
};

const pubSub = (s) => (s ? {
  id: s.id, planId: s.planId, planName: s.planName, interval: s.interval, amount: s.amount, currency: s.currency,
  status: s.status, provider: s.provider, paymentMethod: s.paymentMethod || null,
  currentPeriodEnd: s.currentPeriodEnd, cancelAtPeriodEnd: !!s.cancelAtPeriodEnd, createdAt: s.createdAt,
} : null);

const safeBase = (origin) => {
  try { const u = new URL(String(origin)); if (['http:', 'https:'].includes(u.protocol)) return u.origin; } catch { /* usa el valor por defecto */ }
  return process.env.ALUMNO_URL || 'http://localhost:5180';
};

r.get('/subscription', wrap(async (req, res) => {
  const sub = await getSubscription(req.student.subscriptionId);
  return ok(res, { mode: stripeMode(), subscription: sub && sub.status === 'active' ? pubSub(sub) : null, plan: req.student.plan || 'free' });
}));

// Inicia el pago de un plan. Devuelve la URL de Stripe (real) o un id de sesión para la pantalla simulada.
r.post('/subscription/checkout', wrap(async (req, res) => {
  const { planId, interval, origin } = req.body || {};
  if (!PAID_PLANS.includes(planId)) return fail(res, 400, 'VALIDATION', 'Elige un plan de pago');
  if (!['monthly', 'yearly'].includes(interval)) return fail(res, 400, 'VALIDATION', 'Elige pago mensual o anual');
  const plan = await getDoc(COL.plans, planId);
  if (!plan || plan.published === false) return fail(res, 404, 'NOT_FOUND', 'Plan no encontrado');
  const u = req.student;
  const cur = await getSubscription(u.subscriptionId);
  if (cur?.status === 'active' && cur.planId === planId && cur.interval === interval && !cur.cancelAtPeriodEnd) {
    return fail(res, 409, 'ALREADY_SUBSCRIBED', 'Ya tienes este plan activo');
  }
  const amount = priceCents(plan, interval);
  if (!Number.isInteger(amount) || amount < 50) return fail(res, 400, 'VALIDATION', 'El plan no tiene un precio válido para ese período');
  const now = new Date();
  const base = safeBase(origin);

  if (stripeEnabled()) {
    let session;
    try {
      session = await createCheckoutSession({
        userId: u.id, email: u.email, planId, planName: plan.name?.es || planId, interval, amount,
        successUrl: `${base}/pago/exito?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${base}/planes`,
      });
    } catch (e) { return fail(res, 502, 'STRIPE_ERROR', e.message); }
    await db.collection(COL.checkoutSessions).doc(session.id).set({
      userId: u.id, planId, interval, amount, provider: 'stripe', status: 'open', createdAt: now.toISOString(),
    });
    return created(res, { mode: 'stripe_test', sessionId: session.id, url: session.url });
  }

  const id = `cs_test_mock_${crypto.randomBytes(10).toString('hex')}`;
  await db.collection(COL.checkoutSessions).doc(id).set({
    userId: u.id, planId, interval, amount, provider: 'stripe_mock', status: 'open',
    createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 30 * 60000).toISOString(),
  });
  return created(res, { mode: 'simulated', sessionId: id, url: null });
}));

// Datos de la sesión para dibujar la pantalla de pago simulada.
r.get('/subscription/session/:id', wrap(async (req, res) => {
  const s = await getDoc(COL.checkoutSessions, req.params.id);
  if (!s || s.userId !== req.student.id || s.provider !== 'stripe_mock') return fail(res, 404, 'NOT_FOUND', 'Sesión de pago no encontrada');
  const plan = await getDoc(COL.plans, s.planId);
  return ok(res, {
    id: s.id, status: s.status, planId: s.planId, planName: plan?.name?.es || s.planId, interval: s.interval,
    amount: s.amount, currency: 'usd', email: req.student.email, expired: new Date(s.expiresAt) < new Date(),
  });
}));

// Pago simulado con tarjeta de prueba. Solo acepta las tarjetas de prueba de Stripe; no guarda el número.
r.post('/subscription/mock-pay', wrap(async (req, res) => {
  const { sessionId, number, exp, cvc, name } = req.body || {};
  const u = req.student;
  const s = await getDoc(COL.checkoutSessions, String(sessionId || ''));
  if (!s || s.userId !== u.id || s.provider !== 'stripe_mock') return fail(res, 404, 'NOT_FOUND', 'Sesión de pago no encontrada');
  if (s.status === 'complete') return fail(res, 409, 'ALREADY_PAID', 'Este pago ya fue completado');
  if (new Date(s.expiresAt) < new Date()) return fail(res, 410, 'SESSION_EXPIRED', 'La sesión de pago expiró. Vuelve a elegir tu plan.');

  const pan = String(number || '').replace(/\D/g, '');
  const m = String(exp || '').replace(/\s/g, '').match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  const cv = String(cvc || '').replace(/\D/g, '');
  if (!String(name || '').trim()) return fail(res, 400, 'VALIDATION', 'Escribe el nombre que aparece en la tarjeta');
  if (!m) return fail(res, 400, 'VALIDATION', 'La fecha de vencimiento debe ser MM/AA');
  const month = Number(m[1]); const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12) return fail(res, 400, 'VALIDATION', 'El mes de vencimiento no es válido');
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return fail(res, 402, 'CARD_DECLINED', 'Tu tarjeta ha expirado.', { code: 'expired_card' });
  if (cv.length < 3 || cv.length > 4) return fail(res, 400, 'VALIDATION', 'El CVC debe tener 3 o 4 dígitos');
  const card = TEST_CARDS[pan];
  if (!card) return fail(res, 400, 'NOT_TEST_CARD', 'Modo de prueba: usa una tarjeta de prueba de Stripe, por ejemplo 4242 4242 4242 4242.');

  const plan = await getDoc(COL.plans, s.planId);
  const pm = { brand: card.brand, last4: pan.slice(-4), expMonth: month, expYear: year };
  if (card.fail) {
    await recordFailedPayment({ user: u, plan, amount: s.amount, provider: 'stripe_mock', code: card.fail[0], reason: card.fail[1], paymentMethod: { brand: pm.brand, last4: pm.last4 } });
    return fail(res, 402, 'CARD_DECLINED', card.fail[1], { code: card.fail[0] });
  }

  const periodStart = now.toISOString();
  const periodEnd = new Date(now.getTime() + PERIOD_MS[s.interval]).toISOString();
  const out = await activateSubscription({
    user: u, plan, interval: s.interval, amount: s.amount, provider: 'stripe_mock', sessionId: s.id,
    stripe: { customerId: `cus_mock_${crypto.createHash('sha1').update(u.id).digest('hex').slice(0, 14)}`, subscriptionId: rid('sub_mock'), paymentIntentId: rid('pi_mock') },
    paymentMethod: pm, periodStart, periodEnd,
  });
  const sub = await getSubscription(out.id);
  return ok(res, { subscription: pubSub(sub), replayed: out.replay });
}));

// Stripe real: al volver del checkout se verifica el pago directamente con Stripe.
r.post('/subscription/confirm', wrap(async (req, res) => {
  const u = req.student;
  const sessionId = String(req.body?.sessionId || '');
  if (!sessionId || sessionId.includes('/')) return fail(res, 400, 'VALIDATION', 'Falta la sesión de pago');
  const s = await getDoc(COL.checkoutSessions, sessionId);
  if (!s || s.userId !== u.id || s.provider !== 'stripe') return fail(res, 404, 'NOT_FOUND', 'Sesión de pago no encontrada');
  if (s.status === 'complete') return ok(res, { subscription: pubSub(await getSubscription(s.subscriptionId)), replayed: true });
  if (!stripeEnabled()) return fail(res, 503, 'STRIPE_DISABLED', 'Stripe no está configurado en el servidor');

  let cs;
  try { cs = await retrieveCheckoutSession(sessionId); } catch (e) { return fail(res, 502, 'STRIPE_ERROR', e.message); }
  if (cs.client_reference_id !== u.id) return fail(res, 403, 'AUTH_FORBIDDEN', 'La sesión no corresponde a tu cuenta');
  if (cs.payment_status !== 'paid' || !cs.subscription || typeof cs.subscription !== 'object') return fail(res, 402, 'PAYMENT_PENDING', 'El pago aún no se completa');

  const st = cs.subscription; const card = st.default_payment_method?.card;
  const plan = await getDoc(COL.plans, s.planId);
  const end = st.current_period_end ?? st.items?.data?.[0]?.current_period_end;
  const start = st.current_period_start ?? st.items?.data?.[0]?.current_period_start;
  const out = await activateSubscription({
    user: u, plan, interval: s.interval, amount: cs.amount_total ?? s.amount, provider: 'stripe', sessionId,
    stripe: { customerId: typeof cs.customer === 'object' ? cs.customer?.id : cs.customer, subscriptionId: st.id, paymentIntentId: null },
    paymentMethod: card ? { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year } : null,
    periodStart: new Date((start || Date.now() / 1000) * 1000).toISOString(),
    periodEnd: new Date((end || (Date.now() + PERIOD_MS[s.interval]) / 1000) * 1000).toISOString(),
  });
  return ok(res, { subscription: pubSub(await getSubscription(out.id)), replayed: out.replay });
}));

async function setCancel(req, res, cancel) {
  const u = req.student;
  const s = await getSubscription(u.subscriptionId);
  if (!s || s.status !== 'active') return fail(res, 404, 'NOT_FOUND', 'No tienes una suscripción activa');
  if (s.provider === 'stripe' && s.stripeSubscriptionId) {
    try { await setCancelAtPeriodEnd(s.stripeSubscriptionId, cancel); } catch (e) { return fail(res, 502, 'STRIPE_ERROR', e.message); }
  }
  const now = new Date().toISOString();
  await db.collection(COL.subscriptions).doc(s.id).set({ cancelAtPeriodEnd: cancel, canceledAt: cancel ? now : null, updatedAt: now }, { merge: true });
  await db.collection(COL.users).doc(u.id).set({ planExpiresAt: cancel ? s.currentPeriodEnd : null, updatedAt: now }, { merge: true });
  return ok(res, { subscription: pubSub(await getSubscription(s.id)) });
}
r.post('/subscription/cancel', wrap((req, res) => setCancel(req, res, true)));
r.post('/subscription/resume', wrap((req, res) => setCancel(req, res, false)));

export default r;
