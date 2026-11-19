// Actividad en vivo para la consola: canjes y tickets creados después de `since`.
// La consola lo consulta cada pocos segundos (polling) y así funciona igual en
// local que en Vercel (sin conexiones persistentes). Solo lectura.
// GET /admin/live?since=<ISO>  ->  { now, events: [...] }
import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { COL, db, getDoc } from '../data/repo.js';

const r = Router();
const LIMIT = 20;

r.get('/live', wrap(async (req, res) => {
  const now = new Date().toISOString();
  const since = req.query.since;
  if (since === undefined) return ok(res, { now, events: [] });
  if (typeof since !== 'string' || Number.isNaN(new Date(since).getTime())) {
    return fail(res, 400, 'VALIDATION', 'since debe ser una fecha ISO');
  }
  const sinceIso = new Date(since).toISOString();

  const [rdmSnap, tkSnap, corSnap, subSnap] = await Promise.all([
    db.collection(COL.benefitRedemptions).where('createdAt', '>', sinceIso).limit(LIMIT).get(),
    db.collection(COL.tickets).where('createdAt', '>', sinceIso).limit(LIMIT).get(),
    db.collection(COL.corrections).where('createdAt', '>', sinceIso).limit(LIMIT).get(),
    db.collection(COL.subscriptions).where('createdAt', '>', sinceIso).limit(LIMIT).get(),
  ]);

  const redeems = await Promise.all(rdmSnap.docs.map(async (d) => {
    const x = d.data();
    const [user, ben] = await Promise.all([getDoc(COL.users, x.userId), x.benefitId ? getDoc(COL.benefits, x.benefitId) : null]);
    return {
      type: 'redeem', id: d.id, createdAt: x.createdAt,
      userId: x.userId, userName: user?.name || x.userId,
      benefitName: x.benefitName || ben?.name || '', sponsorName: ben?.sponsorName || '',
      platinumSpent: x.platinumSpent ?? 0, cantidad: x.cantidad ?? 1, channel: x.channel || 'admin',
    };
  }));
  const tickets = tkSnap.docs.map((d) => {
    const t = d.data();
    return {
      type: 'ticket', id: d.id, createdAt: t.createdAt, number: t.number,
      userName: t.userName || t.userId || '', subject: t.subject || '',
    };
  });

  const corrections = corSnap.docs.map((d) => {
    const c = d.data();
    return { type: 'correction', id: d.id, createdAt: c.createdAt, userName: c.userName || c.userId || '', questionId: c.questionId || '' };
  });

  const subscriptions = subSnap.docs.map((d) => {
    const s = d.data();
    return { type: 'subscription', id: d.id, createdAt: s.createdAt, userName: s.userName || s.userId || '', planName: s.planName || s.planId, interval: s.interval, amount: s.amount };
  });

  const events = [...redeems, ...tickets, ...corrections, ...subscriptions].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return ok(res, { now, events });
}));

export default r;
