// Suscripciones de alumnos para la consola (solo lectura): resumen, listado y detalle con historial de cobros.
// GET /admin/subscriptions?status=&plan=&q=     GET /admin/subscriptions/:id
import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, db, getDoc, listAll } from '../data/repo.js';
import { stripeMode } from '../lib/stripe.js';

const r = Router();

// Equivalente mensual (centavos) de una suscripción, para calcular el ingreso recurrente (MRR).
const monthly = (s) => (s.interval === 'yearly' ? Math.round(s.amount / 12) : s.amount);

r.get('/subscriptions', requireRole('finance'), wrap(async (req, res) => {
  const [subs, pays] = await Promise.all([listAll(COL.subscriptions), listAll(COL.payments)]);
  const active = subs.filter((s) => s.status === 'active');
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const ok_ = pays.filter((p) => p.status === 'succeeded');
  const byPlan = {};
  for (const s of active) { const k = s.planId; (byPlan[k] ||= { planId: k, planName: s.planName, count: 0, mrr: 0 }); byPlan[k].count += 1; byPlan[k].mrr += monthly(s); }

  const summary = {
    mode: stripeMode(),
    active: active.length,
    canceling: active.filter((s) => s.cancelAtPeriodEnd).length,
    canceled: subs.filter((s) => s.status === 'canceled').length,
    total: subs.length,
    mrr: active.reduce((a, s) => a + monthly(s), 0),
    revenueTotal: ok_.reduce((a, p) => a + p.amount, 0),
    revenueMonth: ok_.filter((p) => new Date(p.createdAt) >= monthStart).reduce((a, p) => a + p.amount, 0),
    failedPayments: pays.filter((p) => p.status === 'failed').length,
    byPlan: Object.values(byPlan),
  };

  let rows = subs;
  const { status, plan, q } = req.query;
  if (status) rows = rows.filter((s) => (status === 'canceling' ? s.status === 'active' && s.cancelAtPeriodEnd : s.status === status));
  if (plan) rows = rows.filter((s) => s.planId === plan);
  if (q) {
    const t = String(q).toLowerCase();
    rows = rows.filter((s) => [s.userName, s.userEmail, s.userId, s.stripeCustomerId, s.stripeSubscriptionId].some((x) => String(x || '').toLowerCase().includes(t)));
  }
  rows = rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return ok(res, rows, 200, { summary });
}));

r.get('/subscriptions/:id', requireRole('finance'), wrap(async (req, res) => {
  if (req.params.id.includes('/')) return fail(res, 400, 'VALIDATION', 'id inválido');
  const sub = await getDoc(COL.subscriptions, req.params.id);
  if (!sub) return fail(res, 404, 'NOT_FOUND', 'Suscripción no encontrada');
  // Cobros de la suscripción + intentos fallidos del mismo alumno (sin suscripción asociada)
  const snap = await db.collection(COL.payments).where('userId', '==', sub.userId).get();
  const payments = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.subscriptionId === sub.id || p.subscriptionId === null)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return ok(res, { ...sub, payments });
}));

export default r;
