// Negocio REAL de la plataforma (suscripciones, cobros, canjes, medallas) sobrepuesto a las métricas
// sintéticas del Resumen y Comercial. Las métricas base (descargas, MAU, etc.) siguen siendo sintéticas
// mientras no exista el pipeline real de eventos; lo que SÍ ocurre en la plataforma se suma encima:
//   · MRR y recaudación por plan  ← suscripciones activas (equivalente mensual)
//   · Convertidos                 ← alumnos que han pagado alguna vez
//   · Canjes de beneficios        ← benefitRedemptions del período
//   · Medallas emitidas           ← medalLedger (event 'earn') del período
// Los flujos se miden hasta AHORA (incluye hoy y el mes en curso), para que un pago nuevo se vea de inmediato.
import { COL, db, listAll } from '../data/repo.js';

const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'platinum'];
const monthlyUsd = (s) => (s.interval === 'yearly' ? s.amount / 12 : s.amount) / 100;
const round2 = (n) => Math.round(n * 100) / 100;
const MAX_USERS_LEDGER = 300; // tope de alumnos a recorrer para medallas (tamaño de demo)

// ¿La suscripción estaba vigente en el instante ts? (para el MRR del período anterior)
const activeAt = (s, ts) => s.createdAt <= ts && (!s.endedAt || s.endedAt > ts);

export async function realSnapshot({ curStart, prevStart }) {
  const nowIso = new Date().toISOString();
  const [subs, paySnap, rdmSnap, users] = await Promise.all([
    listAll(COL.subscriptions),
    db.collection(COL.payments).where('createdAt', '>=', prevStart).get(),
    db.collection(COL.benefitRedemptions).where('createdAt', '>=', prevStart).get(),
    listAll(COL.users),
  ]);

  const active = subs.filter((s) => s.status === 'active');
  const byPlan = {};
  for (const s of active) byPlan[s.planId] = round2((byPlan[s.planId] || 0) + monthlyUsd(s));
  const mrr = round2(active.reduce((a, s) => a + monthlyUsd(s), 0));
  const mrrPrev = round2(subs.filter((s) => activeAt(s, curStart)).reduce((a, s) => a + monthlyUsd(s), 0));

  const pays = paySnap.docs.map((d) => d.data()).filter((p) => p.status === 'succeeded');
  const collected = round2(pays.filter((p) => p.createdAt >= curStart && p.createdAt <= nowIso).reduce((a, p) => a + p.amount, 0) / 100);
  const collectedPrev = round2(pays.filter((p) => p.createdAt >= prevStart && p.createdAt < curStart).reduce((a, p) => a + p.amount, 0) / 100);

  const rdm = rdmSnap.docs.map((d) => d.data());
  const sum = (rows) => rows.reduce((a, x) => a + (Number(x.cantidad) || 1), 0);
  const redemptions = {
    cur: sum(rdm.filter((x) => x.createdAt >= curStart)),
    prev: sum(rdm.filter((x) => x.createdAt >= prevStart && x.createdAt < curStart)),
  };

  // Medallas ganadas en el período actual (suma por nivel), recorriendo el historial de cada alumno.
  const badges = { total: 0, ...Object.fromEntries(TIERS.map((t) => [t, 0])) };
  await Promise.all(users.slice(0, MAX_USERS_LEDGER).map(async (u) => {
    try {
      const snap = await db.collection(COL.users).doc(u.id).collection('medalLedger').where('createdAt', '>=', curStart).get();
      for (const d of snap.docs) {
        const x = d.data();
        if (x.event === 'earn' && badges[x.tier] !== undefined && x.amount > 0) { badges[x.tier] += x.amount; badges.total += x.amount; }
      }
    } catch { /* un alumno sin historial legible no frena el resto */ }
  }));

  return {
    mrr, mrrPrev, byPlan, activeSubs: active.length, canceling: active.filter((s) => s.cancelAtPeriodEnd).length,
    convertedEver: new Set(subs.map((s) => s.userId)).size,
    collected, collectedPrev, redemptions, badges,
  };
}

const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0);
const realBlock = (real) => ({
  activeSubs: real.activeSubs, canceling: real.canceling, mrr: real.mrr, collected: real.collected,
  redemptions: real.redemptions.cur, badges: real.badges.total, converted: real.convertedEver,
});

// Suma lo real a un Resumen ya compuesto. `base` trae el MRR/MAU sintéticos de los que se partió.
export function overlayOverview(data, base, real) {
  const mrr = round2(base.mrr + real.mrr);
  const converted = base.converted + real.convertedEver;
  const plans = new Map((data.revenueByPlan || []).map((p) => [p.plan, p.value]));
  for (const [plan, v] of Object.entries(real.byPlan)) plans.set(plan, round2((plans.get(plan) || 0) + v));
  return {
    ...data,
    mrr: { value: mrr, deltaPct: pct(mrr, base.mrrPrev + real.mrrPrev) },
    converted: { value: converted, rate: Math.round((converted / (base.mau || 1)) * 1000) / 10 },
    badgesIssued: (data.badgesIssued || 0) + real.badges.total,
    revenueByPlan: [...plans.entries()].map(([plan, value]) => ({ plan, value })),
    real: realBlock(real),
  };
}

export function overlayCommercial(data, base, real) {
  const mrr = round2(base.mrr + real.mrr);
  const converted = base.converted + real.convertedEver;
  const plans = new Map((data.revenueByPlan || []).map((p) => [p.plan, p.value]));
  for (const [plan, v] of Object.entries(real.byPlan)) plans.set(plan, round2((plans.get(plan) || 0) + v));
  return {
    ...data,
    mrr, converted,
    convRate: Math.round((converted / (data.mau || 1)) * 1000) / 10,
    benefitsRedeemed: (data.benefitsRedeemed || 0) + real.redemptions.cur,
    funnel: (data.funnel || []).map((f) => (f.label === 'Convertidos' ? { ...f, value: converted } : f)),
    revenueByPlan: [...plans.entries()].map(([plan, value]) => ({ plan, value })),
    badgesByType: (data.badgesByType || []).map((b) => ({ ...b, value: b.value + (real.badges[b.tier] || 0) })),
    real: { ...realBlock(real), collectedPrev: real.collectedPrev, redemptionsPrev: real.redemptions.prev },
  };
}
