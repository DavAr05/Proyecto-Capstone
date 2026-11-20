// API de la app del alumno (MÓDULO DE DEMOSTRACIÓN, fuera del alcance formal).
// Montada en /api/v1/student. Login sin contraseña: eliges un alumno del seed.
// Se desactiva con STUDENT_DEMO=off (obligatorio en producción real).
import { Router } from 'express';
import { ok, created, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { verify, signStudent } from '../lib/jwt.js';
import { redeemBenefit } from '../lib/redeem.js';
import { COL, db, listAll, getDoc, nextTicketNumber } from '../data/repo.js';
import learn from './student-learn.js';
import billing from './student-billing.js';
import { refreshSubscription } from '../lib/billing.js';

const r = Router();

r.use((req, res, next) => (process.env.STUDENT_DEMO === 'off'
  ? fail(res, 404, 'NOT_FOUND', 'No encontrado')
  : next()));

const pubUser = (u) => ({
  id: u.id, name: u.name, email: u.email, plan: u.plan || null, state: u.state || 'active',
  medals: { bronze: 0, silver: 0, gold: 0, diamond: 0, platinum: 0, ...(u.medals || {}) },
  streak: u.streak ?? 0, prefs: u.prefs || {},
});

const pubBenefit = (b) => ({
  id: b.id, name: b.name, sponsorId: b.sponsorId, sponsorName: b.sponsorName || '',
  description: b.description || null, costPlatinum: b.costPlatinum, stock: b.stock ?? null,
  expiresAt: b.expiresAt || null,
});

// Lista de alumnos para el selector de login de la demo.
r.get('/users', wrap(async (_req, res) => {
  const all = await listAll(COL.users);
  return ok(res, all.filter((u) => (u.state || 'active') === 'active')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((u) => ({ id: u.id, name: u.name, email: u.email, platinum: u.medals?.platinum ?? 0 })));
}));

r.post('/login', wrap(async (req, res) => {
  const { userId } = req.body || {};
  if (typeof userId !== 'string' || !userId.trim() || userId.includes('/')) return fail(res, 400, 'VALIDATION', 'userId es obligatorio');
  const user = await getDoc(COL.users, userId.trim());
  if (!user) return fail(res, 404, 'NOT_FOUND', 'Alumno no encontrado');
  if (user.state && user.state !== 'active') return fail(res, 422, 'USER_NOT_ACTIVE', 'El alumno no está activo');
  return ok(res, { token: signStudent(user), user: pubUser(user) });
}));

// Todo lo que sigue exige token de alumno.
async function studentRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return fail(res, 401, 'AUTH_REQUIRED', 'Falta el token');
  let p;
  try { p = verify(token); } catch { return fail(res, 401, 'AUTH_INVALID', 'Token inválido o expirado'); }
  if (p.typ !== 'student' || typeof p.sub !== 'string' || p.sub.includes('/')) return fail(res, 401, 'AUTH_INVALID', 'Token inválido');
  try {
    const user = await getDoc(COL.users, p.sub);
    if (!user) return fail(res, 401, 'AUTH_INVALID', 'Alumno no encontrado');
    if (user.state && user.state !== 'active') return fail(res, 422, 'USER_NOT_ACTIVE', 'El alumno no está activo');
    await refreshSubscription(user); // renueva/vence la suscripción si terminó el período
    req.student = user;
    return next();
  } catch (e) { return next(e); }
}
r.use(studentRequired);
r.use(learn);
r.use(billing);

r.get('/me', wrap(async (req, res) => ok(res, pubUser(req.student))));

r.get('/benefits', wrap(async (_req, res) => {
  const all = await listAll(COL.benefits);
  return ok(res, all.filter((b) => b.active !== false && (b.stock === null || b.stock === undefined || b.stock > 0))
    .sort((a, b) => (a.costPlatinum || 0) - (b.costPlatinum || 0)).map(pubBenefit));
}));

r.post('/benefits/:id/redeem', wrap(async (req, res) => {
  const { requestId } = req.body || {};
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 100) return fail(res, 400, 'VALIDATION', 'requestId es obligatorio (8 a 100 caracteres)');
  if (req.params.id.includes('/')) return fail(res, 400, 'VALIDATION', 'id inválido');
  const result = await redeemBenefit({ benefitId: req.params.id, userId: req.student.id, requestId });
  if (result.error) return fail(res, ...result.error);
  const user = await getDoc(COL.users, req.student.id);
  return ok(res, { redemption: { id: result.id, ...result.receipt }, replayed: result.replay, user: pubUser(user) });
}));

r.get('/redemptions', wrap(async (req, res) => {
  const snap = await db.collection(COL.benefitRedemptions).where('userId', '==', req.student.id).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return ok(res, rows);
}));

const CATEGORIES = ['login', 'payments', 'other'];

r.get('/tickets', wrap(async (req, res) => {
  const snap = await db.collection(COL.tickets).where('userId', '==', req.student.id).get();
  const rows = snap.docs.map((d) => {
    const t = d.data();
    return { id: d.id, number: t.number, subject: t.subject, category: t.category, status: t.status, createdAt: t.createdAt };
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return ok(res, rows);
}));

r.post('/tickets', wrap(async (req, res) => {
  const subject = String(req.body?.subject ?? '').trim();
  const body = String(req.body?.body ?? '').trim();
  const category = CATEGORIES.includes(req.body?.category) ? req.body.category : 'other';
  if (subject.length < 3 || subject.length > 120) return fail(res, 400, 'VALIDATION', 'El asunto debe tener entre 3 y 120 caracteres');
  if (body.length < 3 || body.length > 2000) return fail(res, 400, 'VALIDATION', 'El mensaje debe tener entre 3 y 2000 caracteres');
  const u = req.student;
  const number = await nextTicketNumber();
  const now = new Date().toISOString();
  const ref = db.collection(COL.tickets).doc();
  const batch = db.batch();
  batch.set(ref, {
    number, subject, subjectLower: subject.toLowerCase(), category,
    userId: u.id, userName: u.name, userEmail: u.email,
    priority: 'med', priorityRank: 1, status: 'open', assigneeId: null, assigneeName: null, channel: 'app',
    createdAt: now, closedAt: null, messagesCount: 1, lastMessageAt: now, updatedAt: now,
  });
  batch.set(ref.collection('messages').doc(), {
    authorType: 'user', authorId: u.id, authorName: u.name, body, internal: false, createdAt: now, expiresAt: null,
  });
  await batch.commit();
  return created(res, { id: ref.id, number, subject, category, status: 'open', createdAt: now });
}));

export default r;
