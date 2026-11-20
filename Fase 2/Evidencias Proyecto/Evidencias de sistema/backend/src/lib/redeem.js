// Canje de un beneficio por un alumno (app del alumno). Misma lógica y mismas
// reglas que el canje administrativo de routes/sponsors.js: una transacción que
// valida estado/stock/saldo, descuenta platino, baja stock, sube redeemedCount y
// deja comprobante (benefitRedemptions) + asiento (users/{id}/medalLedger).
// Idempotente por requestId: reintentar devuelve el mismo comprobante sin cobrar.
import crypto from 'node:crypto';
import { COL, db, FieldValue } from '../data/repo.js';

export async function redeemBenefit({ benefitId, userId, requestId, cantidad = 1 }) {
  const benRef = db.collection(COL.benefits).doc(benefitId);
  const userRef = db.collection(COL.users).doc(userId);
  const rdmRef = db.collection(COL.benefitRedemptions)
    .doc(`rdm_${crypto.createHash('sha1').update(`${benefitId}:${userId}:${requestId}`).digest('hex').slice(0, 20)}`);

  return db.runTransaction(async (tx) => {
    const [benSnap, userSnap, rdmSnap] = await Promise.all([tx.get(benRef), tx.get(userRef), tx.get(rdmRef)]);
    if (rdmSnap.exists) return { replay: true, id: rdmRef.id, receipt: rdmSnap.data() };
    if (!benSnap.exists) return { error: [404, 'NOT_FOUND', 'Beneficio no encontrado'] };
    if (!userSnap.exists) return { error: [404, 'NOT_FOUND', 'Alumno no encontrado'] };
    const ben = benSnap.data(); const user = userSnap.data();
    if (ben.active === false) return { error: [409, 'BENEFIT_INACTIVE', 'El beneficio no está disponible'] };
    if (user.state && user.state !== 'active') return { error: [422, 'USER_NOT_ACTIVE', 'El alumno no está activo'] };
    const unlimited = ben.stock === null || ben.stock === undefined;
    if (!unlimited && ben.stock < cantidad) return { error: [400, 'VALIDATION', 'Stock insuficiente'] };
    const cost = (Number(ben.costPlatinum) || 0) * cantidad;
    const medals = { bronze: 0, silver: 0, gold: 0, diamond: 0, platinum: 0, ...(user.medals || {}) };
    if (medals.platinum < cost) return { error: [422, 'INSUFFICIENT_MEDALS', 'No tienes suficiente platino'] };

    const now = new Date().toISOString();
    const stockAfter = unlimited ? null : ben.stock - cantidad;
    medals.platinum -= cost;
    const receipt = {
      userId, benefitId, benefitName: ben.name, sponsorId: ben.sponsorId,
      couponCode: `APR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      platinumSpent: cost, cantidad, totalCostPlatinum: cost, balanceAfter: medals.platinum, stockAfter,
      requestId, by: userId, channel: 'student_app', createdAt: now,
    };
    tx.set(rdmRef, receipt);
    tx.set(userRef, { medals, updatedAt: now }, { merge: true });
    tx.set(userRef.collection('medalLedger').doc(), {
      event: 'redeem', tier: 'platinum', amount: -cost, reason: 'benefit_redeemed',
      refType: 'benefit', refId: benefitId, by: userId, createdAt: now,
    });
    tx.set(benRef, {
      ...(unlimited ? {} : { stock: stockAfter, active: stockAfter > 0 }),
      redeemedCount: (ben.redeemedCount || 0) + cantidad,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { replay: false, id: rdmRef.id, receipt };
  });
}
