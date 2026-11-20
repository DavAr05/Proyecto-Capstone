// Práctica del alumno (módulo de demostración, parte de /api/v1/student):
// inicio "Hoy" (racha, cuota, progreso), pregunta siguiente, responder, pedir
// recorrección, medallas (colección y canje entre niveles), planes y perfil.
// Se monta DESPUÉS de studentRequired, así que `req.student` ya existe.
import { Router } from 'express';
import { ok, created, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { COL, db, listAll, getDoc } from '../data/repo.js';

const r = Router();

const TESTS = [
  { id: 'm1', es: 'Matemática M1', en: 'Math M1' },
  { id: 'l1', es: 'Competencia lectora', en: 'Reading' },
  { id: 'b1', es: 'Biología', en: 'Biology' },
];
const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'platinum'];
const EXCHANGE_RATE = 5; // 5 medallas de un nivel = 1 del siguiente
const BASE_QUOTA = 10; // cuota base gratis; +5 colegio, +5 dirección (máx. 20)
const LETTERS = 'ABCDE';
const REASONS = ['wrong_answer', 'ambiguous', 'typo', 'bad_explanation', 'other'];
const DIFFS = ['d1', 'd2', 'd3'];

const dayOf = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
const prevDay = (day) => new Date(new Date(`${day}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
const emptyMedals = () => ({ bronze: 0, silver: 0, gold: 0, diamond: 0, platinum: 0 });
const medalsOf = (u) => ({ ...emptyMedals(), ...(u.medals || {}) });

async function planOf(u) {
  const p = await getDoc(COL.plans, u.plan || 'free');
  return p || { id: 'free', limits: { qDay: 20, tests: 1 }, badges: { login: 1, correct: 1 } };
}

// null = ilimitado
function quotaLimit(plan, prefs) {
  const q = plan.limits?.qDay;
  if (q === 0) return null;
  const cap = q || 20;
  return Math.min(cap, BASE_QUOTA + (prefs?.school ? 5 : 0) + (prefs?.address ? 5 : 0));
}

async function usedToday(uid, day) {
  const s = await db.collection(COL.users).doc(uid).collection('answers').where('day', '==', day).get();
  return s.size;
}

const pubQuestion = (q) => ({
  id: q.id, testId: q.testId, axis: q.axis || null, difficulty: q.difficulty || 'd1',
  statement: q.statement, options: q.options,
});

// ── Inicio "Hoy": racha + recompensa diaria (una vez al día), cuota y progreso ──
r.get('/today', wrap(async (req, res) => {
  const uid = req.student.id;
  const day = dayOf();
  const plan = await planOf(req.student);
  const userRef = db.collection(COL.users).doc(uid);

  const loginReward = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const u = snap.data();
    if (u.lastRewardDay === day) return { amount: 0, streak: u.streak ?? 0 };
    const streak = u.lastRewardDay === prevDay(day) ? (u.streak || 0) + 1 : 1;
    const amount = Number(plan.badges?.login ?? 1) || 0;
    const medals = medalsOf(u);
    medals.bronze += amount;
    const now = new Date().toISOString();
    tx.set(userRef, {
      medals, badgesTotal: (u.badgesTotal || 0) + amount, streak, lastRewardDay: day,
      lastActiveAt: now, lastActiveDate: day, updatedAt: now,
    }, { merge: true });
    if (amount) {
      tx.set(userRef.collection('medalLedger').doc(), {
        event: 'earn', tier: 'bronze', amount, reason: 'daily_login', refType: 'login', refId: day, by: uid, createdAt: now,
      });
    }
    return { amount, streak };
  });

  const [user, used, ansSnap] = await Promise.all([
    getDoc(COL.users, uid), usedToday(uid, day),
    userRef.collection('answers').orderBy('createdAt', 'desc').limit(500).get(),
  ]);
  const prefs = user.prefs || {};
  const progress = {};
  for (const d of ansSnap.docs) {
    const a = d.data();
    const p = (progress[a.testId] ||= { answered: 0, correct: 0 });
    p.answered += 1; if (a.correct) p.correct += 1;
  }
  return ok(res, {
    day, streak: user.streak ?? 0, loginReward,
    medals: medalsOf(user),
    quota: { limit: quotaLimit(plan, prefs), used, base: BASE_QUOTA, unlockedSchool: !!prefs.school, unlockedAddress: !!prefs.address },
    plan: { id: plan.id, name: plan.name || null, qDay: plan.limits?.qDay ?? 20, tests: plan.limits?.tests ?? 1 },
    tests: TESTS.map((t) => ({ ...t, ...(progress[t.id] || { answered: 0, correct: 0 }) })),
  });
}));

// ── Perfil / preferencias (pruebas, dificultad, colegio, dirección) ──
r.get('/profile', wrap(async (req, res) => {
  const u = req.student; const plan = await planOf(u);
  return ok(res, { prefs: u.prefs || {}, tests: TESTS, maxTests: plan.limits?.tests ?? 1 });
}));

r.put('/profile', wrap(async (req, res) => {
  const b = req.body || {};
  const u = req.student; const plan = await planOf(u);
  const prefs = { ...(u.prefs || {}) };
  if ('tests' in b) {
    if (!Array.isArray(b.tests) || !b.tests.length || !b.tests.every((t) => TESTS.some((x) => x.id === t))) return fail(res, 400, 'VALIDATION', 'Elige al menos una prueba válida');
    const max = plan.limits?.tests ?? 1;
    if (b.tests.length > max) return fail(res, 422, 'PLAN_LIMIT', `Tu plan permite ${max} prueba${max === 1 ? '' : 's'}. Pásate a un plan con más pruebas.`);
    prefs.tests = [...new Set(b.tests)];
  }
  if ('difficulty' in b) {
    if (!DIFFS.includes(b.difficulty)) return fail(res, 400, 'VALIDATION', 'Dificultad inválida');
    prefs.difficulty = b.difficulty;
  }
  for (const k of ['school', 'address']) {
    if (k in b) { const v = String(b[k] ?? '').trim().slice(0, 120); prefs[k] = v || null; }
  }
  if ('age' in b) { const a = Number(b.age); prefs.age = Number.isInteger(a) && a >= 5 && a <= 99 ? a : null; }
  if ('notif' in b) prefs.notif = !!b.notif;
  await db.collection(COL.users).doc(u.id).set({ prefs, updatedAt: new Date().toISOString() }, { merge: true });
  const used = await usedToday(u.id, dayOf());
  return ok(res, { prefs, quota: { limit: quotaLimit(plan, prefs), used, base: BASE_QUOTA } });
}));

// ── Pregunta siguiente (sin respuesta ni explicación) ──
r.get('/questions/next', wrap(async (req, res) => {
  const u = req.student; const day = dayOf();
  const plan = await planOf(u);
  const prefs = u.prefs || {};
  const limit = quotaLimit(plan, prefs);
  const used = await usedToday(u.id, day);
  if (limit !== null && used >= limit) {
    return fail(res, 403, 'QUOTA_EXCEEDED', 'Llegaste a tu límite diario de preguntas', { limit, used, canUnlock: limit < (plan.limits?.qDay || 20) });
  }

  const tests = TESTS.some((t) => t.id === req.query.testId) ? [req.query.testId] : (prefs.tests?.length ? prefs.tests : ['m1']);
  const diff = DIFFS.includes(req.query.difficulty) ? req.query.difficulty : (prefs.difficulty || null);
  const [all, ansSnap] = await Promise.all([
    listAll(COL.questions),
    db.collection(COL.users).doc(u.id).collection('answers').orderBy('createdAt', 'desc').limit(500).get(),
  ]);
  const seen = new Set(ansSnap.docs.map((d) => d.data().questionId));
  let pool = all.filter((q) => q.status === 'published' && tests.includes(q.testId) && Array.isArray(q.options) && q.options.length >= 2);
  if (diff) { const byDiff = pool.filter((q) => (q.difficulty || 'd1') === diff); if (byDiff.length) pool = byDiff; }
  const fresh = pool.filter((q) => !seen.has(q.id));
  const from = fresh.length ? fresh : pool;
  if (!from.length) return fail(res, 404, 'NO_QUESTIONS', 'No hay preguntas disponibles para tus pruebas todavía');
  const pick = from[Math.floor(Math.random() * from.length)];
  return ok(res, { question: pubQuestion(pick), quota: { limit, used }, seenAll: !fresh.length });
}));

// ── Responder: corrige, suma medalla de bronce si acierta, devuelve explicación ──
r.post('/questions/:id/answer', wrap(async (req, res) => {
  const u = req.student; const day = dayOf();
  const chosen = String(req.body?.chosen ?? '').toUpperCase();
  const ms = Math.max(0, Math.min(3600000, Number(req.body?.ms) || 0));
  if (req.params.id.includes('/')) return fail(res, 400, 'VALIDATION', 'id inválido');
  const q = await getDoc(COL.questions, req.params.id);
  if (!q || q.status !== 'published') return fail(res, 404, 'NOT_FOUND', 'Pregunta no encontrada');
  if (!chosen || !LETTERS.slice(0, q.options.length).includes(chosen)) return fail(res, 400, 'VALIDATION', 'Alternativa inválida');

  const plan = await planOf(u);
  const prefs = u.prefs || {};
  const limit = quotaLimit(plan, prefs);
  const userRef = db.collection(COL.users).doc(u.id);
  const ansRef = userRef.collection('answers').doc(`${day}_${q.id}`);

  const pre = await ansRef.get();
  const used0 = await usedToday(u.id, day);
  if (!pre.exists && limit !== null && used0 >= limit) return fail(res, 403, 'QUOTA_EXCEEDED', 'Llegaste a tu límite diario de preguntas', { limit, used: used0 });

  const correct = chosen === String(q.correctAnswer).toUpperCase();
  const reward = Number(plan.badges?.correct ?? 1) || 0;

  const out = await db.runTransaction(async (tx) => {
    const [aSnap, uSnap] = await Promise.all([tx.get(ansRef), tx.get(userRef)]);
    if (aSnap.exists) return { replay: true, correct: aSnap.data().correct, reward: 0, medals: medalsOf(uSnap.data()) };
    const user = uSnap.data();
    const now = new Date().toISOString();
    const medals = medalsOf(user);
    let earned = 0;
    if (correct && reward > 0) {
      earned = reward; medals.bronze += reward;
      tx.set(userRef, { medals, badgesTotal: (user.badgesTotal || 0) + reward, lastActiveAt: now, lastActiveDate: day, updatedAt: now }, { merge: true });
      tx.set(userRef.collection('medalLedger').doc(), {
        event: 'earn', tier: 'bronze', amount: reward, reason: 'correct_answer', refType: 'question', refId: q.id, by: u.id, createdAt: now,
      });
    } else {
      tx.set(userRef, { lastActiveAt: now, lastActiveDate: day, updatedAt: now }, { merge: true });
    }
    tx.set(ansRef, { day, questionId: q.id, testId: q.testId || null, difficulty: q.difficulty || 'd1', chosen, correct, ms, createdAt: now });
    return { replay: false, correct, reward: earned, medals };
  });

  const used = out.replay ? used0 : used0 + 1;
  return ok(res, {
    correct: out.correct, chosen, correctAnswer: String(q.correctAnswer).toUpperCase(),
    explanation: q.explanation || '', requiredSkill: q.requiredSkill || '',
    reward: out.reward ? { tier: 'bronze', amount: out.reward } : null,
    medals: out.medals, quota: { limit, used }, replayed: out.replay,
  });
}));

// ── Solicitar recorrección (llega a la bandeja de Recorrecciones de la consola) ──
r.post('/questions/:id/correction', wrap(async (req, res) => {
  const u = req.student;
  const { reason, comment, proposedAnswer } = req.body || {};
  if (!REASONS.includes(reason)) return fail(res, 400, 'VALIDATION', 'Elige un motivo');
  if (req.params.id.includes('/')) return fail(res, 400, 'VALIDATION', 'id inválido');
  const q = await getDoc(COL.questions, req.params.id);
  if (!q) return fail(res, 404, 'NOT_FOUND', 'Pregunta no encontrada');
  const prop = LETTERS.slice(0, q.options?.length || 0).includes(String(proposedAnswer || '').toUpperCase()) ? String(proposedAnswer).toUpperCase() : null;
  const ref = db.collection(COL.corrections).doc(`cor_${u.id}_${q.id}`);
  const prev = await ref.get();
  if (prev.exists && (prev.data().status || 'pending') === 'pending') return fail(res, 409, 'ALREADY_SENT', 'Ya enviaste una solicitud para esta pregunta; está en revisión');
  await ref.set({
    questionId: q.id, userId: u.id, userName: u.name, reason,
    comment: String(comment ?? '').trim().slice(0, 500), proposedAnswer: prop,
    status: 'pending', createdAt: new Date().toISOString(),
  });
  return created(res, { id: ref.id, status: 'pending' });
}));

// ── Medallas: colección, historial y canje entre niveles ──
r.get('/medals', wrap(async (req, res) => {
  const u = await getDoc(COL.users, req.student.id);
  const snap = await db.collection(COL.users).doc(u.id).collection('medalLedger').orderBy('createdAt', 'desc').limit(15).get();
  const history = snap.docs.map((d) => { const x = d.data(); return { id: d.id, event: x.event, tier: x.tier, amount: x.amount, reason: x.reason, createdAt: x.createdAt }; });
  return ok(res, { medals: medalsOf(u), rate: EXCHANGE_RATE, history });
}));

r.post('/medals/exchange', wrap(async (req, res) => {
  const from = req.body?.from;
  const i = TIERS.indexOf(from);
  if (i < 0 || i === TIERS.length - 1) return fail(res, 400, 'VALIDATION', 'Ese nivel no se puede canjear');
  const to = TIERS[i + 1];
  const userRef = db.collection(COL.users).doc(req.student.id);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const medals = medalsOf(snap.data());
    if (medals[from] < EXCHANGE_RATE) return { error: [422, 'INSUFFICIENT_MEDALS', `Necesitas ${EXCHANGE_RATE} medallas de ${from}`] };
    medals[from] -= EXCHANGE_RATE; medals[to] += 1;
    const now = new Date().toISOString();
    tx.set(userRef, { medals, updatedAt: now }, { merge: true });
    tx.set(userRef.collection('medalLedger').doc(), { event: 'exchange', tier: from, amount: -EXCHANGE_RATE, reason: `exchange_to_${to}`, refType: 'exchange', refId: to, by: req.student.id, createdAt: now });
    tx.set(userRef.collection('medalLedger').doc(), { event: 'exchange', tier: to, amount: 1, reason: `exchange_from_${from}`, refType: 'exchange', refId: from, by: req.student.id, createdAt: now });
    return { medals };
  });
  if (result.error) return fail(res, ...result.error);
  return ok(res, { medals: result.medals, from, to });
}));

// ── Planes (solo lectura: el cobro real depende de Stripe, fuera del alcance) ──
r.get('/plans', wrap(async (req, res) => {
  const all = await listAll(COL.plans);
  const rows = all.filter((p) => p.published !== false).sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((p) => ({ id: p.id, name: p.name?.es || p.id, monthly: p.price?.monthly ?? 0, yearly: p.price?.yearly ?? null, qDay: p.limits?.qDay ?? 0, tests: p.limits?.tests ?? 1, popular: !!p.popular }));
  return ok(res, { plans: rows, current: req.student.plan || 'free' });
}));

export default r;
