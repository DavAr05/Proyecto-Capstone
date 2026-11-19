// Lógica de suscripciones de alumnos (compartida por student-billing.js y la consola).
// Colecciones: subscriptions (una por contratación), payments (cada cobro, incluso fallidos),
// checkoutSessions (intento de pago en curso; su id es el de Stripe o `cs_test_mock_*`).
// Importante: NUNCA se guarda el número completo de tarjeta, solo marca y últimos 4 dígitos.
import crypto from 'node:crypto';
import { COL, db, getDoc } from '../data/repo.js';
import { retrieveSubscription, stripeEnabled } from './stripe.js';

export const PERIOD_MS = { monthly: 30 * 86400000, yearly: 365 * 86400000 };
export const PAID_PLANS = ['uni', 'all'];
export const rid = (p) => `${p}_${crypto.randomBytes(9).toString('hex')}`;

// Precio en centavos de USD desde el documento del plan (price.monthly / price.yearly en USD).
export const priceCents = (plan, interval) => {
  const v = interval === 'yearly' ? plan.price?.yearly : plan.price?.monthly;
  return Math.round(Number(v) * 100);
};

// Activa (o reemplaza) la suscripción del alumno y registra el primer cobro. Idempotente por sessionId.
export async function activateSubscription({ user, plan, interval, amount, provider, stripe = {}, paymentMethod = null, periodStart, periodEnd, sessionId }) {
  const sessRef = db.collection(COL.checkoutSessions).doc(sessionId);
  const userRef = db.collection(COL.users).doc(user.id);
  const subId = rid('sub'); const payId = rid('pay');
  const subRef = db.collection(COL.subscriptions).doc(subId);
  const payRef = db.collection(COL.payments).doc(payId);
  const now = new Date().toISOString();

  return db.runTransaction(async (tx) => {
    const [sessSnap, userSnap] = await Promise.all([tx.get(sessRef), tx.get(userRef)]);
    if (sessSnap.exists && sessSnap.data().status === 'complete' && sessSnap.data().subscriptionId) {
      return { replay: true, id: sessSnap.data().subscriptionId };
    }
    const u = userSnap.data();
    let oldRef = null; let oldSnap = null;
    if (u.subscriptionId && u.subscriptionId !== subId) {
      oldRef = db.collection(COL.subscriptions).doc(u.subscriptionId);
      oldSnap = await tx.get(oldRef);
    }
    const sub = {
      userId: user.id, userName: user.name, userEmail: user.email,
      planId: plan.id, planName: plan.name?.es || plan.id, interval, amount, currency: 'usd',
      status: 'active', provider,
      stripeCustomerId: stripe.customerId || null, stripeSubscriptionId: stripe.subscriptionId || null,
      stripeSessionId: sessionId, paymentMethod,
      currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false,
      createdAt: now, updatedAt: now, canceledAt: null, endedAt: null,
    };
    tx.set(subRef, sub);
    tx.set(payRef, {
      subscriptionId: subId, userId: user.id, userName: user.name, planId: plan.id, amount, currency: 'usd',
      status: 'succeeded', kind: 'initial', provider, stripePaymentIntentId: stripe.paymentIntentId || null,
      paymentMethod, failureCode: null, failureReason: null, createdAt: now,
    });
    if (oldSnap?.exists && oldSnap.data().status === 'active') {
      tx.set(oldRef, { status: 'canceled', endedAt: now, canceledAt: now, cancelReason: 'replaced', updatedAt: now }, { merge: true });
    }
    tx.set(userRef, {
      plan: plan.id, planStatus: 'active', planSource: 'subscription', subscriptionId: subId, planExpiresAt: null,
      stripeCustomerId: stripe.customerId || u.stripeCustomerId || null, updatedAt: now,
    }, { merge: true });
    tx.set(sessRef, { status: 'complete', subscriptionId: subId, completedAt: now }, { merge: true });
    return { replay: false, id: subId, subscription: sub };
  });
}

export async function recordFailedPayment({ user, plan, amount, provider, code, reason, paymentMethod }) {
  const id = rid('pay');
  await db.collection(COL.payments).doc(id).set({
    subscriptionId: null, userId: user.id, userName: user.name, planId: plan.id, amount, currency: 'usd',
    status: 'failed', kind: 'initial', provider, stripePaymentIntentId: null, paymentMethod: paymentMethod || null,
    failureCode: code, failureReason: reason, createdAt: new Date().toISOString(),
  });
  return id;
}

// Cierra un período vencido: renueva (simulado), sincroniza con Stripe (real) o baja a plan gratis.
// Se llama cada vez que el alumno entra; no necesita tareas programadas. Modifica `user` en memoria.
export async function refreshSubscription(user) {
  if (!user.subscriptionId) return user;
  const ref = db.collection(COL.subscriptions).doc(user.subscriptionId);
  const snap = await ref.get();
  if (!snap.exists) return user;
  const s = snap.data();
  const now = Date.now();
  if (s.status !== 'active' || new Date(s.currentPeriodEnd).getTime() > now) return user;

  const nowIso = new Date().toISOString();
  const endIt = async () => {
    await ref.set({ status: 'canceled', endedAt: nowIso, updatedAt: nowIso }, { merge: true });
    await db.collection(COL.users).doc(user.id).set({ plan: 'free', planStatus: 'expired', subscriptionId: null, planExpiresAt: null, updatedAt: nowIso }, { merge: true });
    user.plan = 'free'; user.subscriptionId = null;
  };

  if (s.cancelAtPeriodEnd) { await endIt(); return user; }

  if (s.provider === 'stripe_mock') {
    let end = new Date(s.currentPeriodEnd).getTime(); const step = PERIOD_MS[s.interval] || PERIOD_MS.monthly;
    while (end <= now) end += step;
    await ref.set({ currentPeriodStart: new Date(end - step).toISOString(), currentPeriodEnd: new Date(end).toISOString(), updatedAt: nowIso }, { merge: true });
    await db.collection(COL.payments).doc(rid('pay')).set({
      subscriptionId: user.subscriptionId, userId: user.id, userName: user.name, planId: s.planId, amount: s.amount, currency: 'usd',
      status: 'succeeded', kind: 'renewal', provider: 'stripe_mock', stripePaymentIntentId: null, paymentMethod: s.paymentMethod,
      failureCode: null, failureReason: null, createdAt: nowIso,
    });
    return user;
  }

  if (stripeEnabled() && s.stripeSubscriptionId) {
    try {
      const st = await retrieveSubscription(s.stripeSubscriptionId);
      if (['canceled', 'incomplete_expired', 'unpaid'].includes(st.status)) { await endIt(); return user; }
      const end = st.current_period_end ?? st.items?.data?.[0]?.current_period_end;
      if (end) await ref.set({ currentPeriodEnd: new Date(end * 1000).toISOString(), status: st.status === 'active' ? 'active' : 'past_due', updatedAt: nowIso }, { merge: true });
    } catch { /* sin red con Stripe: se reintenta en la próxima visita */ }
  }
  return user;
}

export const getSubscription = (id) => (id ? getDoc(COL.subscriptions, id) : null);
