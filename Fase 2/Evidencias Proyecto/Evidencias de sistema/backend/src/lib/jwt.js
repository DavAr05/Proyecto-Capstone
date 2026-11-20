import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

// Identificador único de cada refresh token (para rotación).
export const newJti = () => randomUUID();

// En Vercel (producción) es OBLIGATORIO definir JWT_SECRET: con la clave de desarrollo cualquiera
// podría fabricar sesiones. En local sigue funcionando sin configurar nada.
if (process.env.VERCEL && !process.env.JWT_SECRET) {
  throw new Error('Falta la variable de entorno JWT_SECRET en Vercel (Settings → Environment Variables).');
}
const SECRET = process.env.JWT_SECRET || 'dev-secret';
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL || 900);

export const REFRESH_TTL = Number(
  process.env.JWT_REFRESH_TTL || 604800
);

export function signAccess(user, sessionId) {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      role: user.role,
      sid: sessionId,
      typ: 'access',
    },
    SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

export function signRefresh(user, sessionId, jti) {
  return jwt.sign(
    {
      sub: user.id,
      sid: sessionId,
      typ: 'refresh',
    },
    SECRET,
    { expiresIn: REFRESH_TTL, ...(jti ? { jwtid: jti } : {}) }
  );
}

// Token de la app del alumno (módulo de demostración). typ 'student' lo hace
// inservible en la consola: authRequired exige typ 'access'.
export function signStudent(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, typ: 'student' },
    SECRET,
    { expiresIn: Number(process.env.STUDENT_TOKEN_TTL || 43200) }
  );
}

export function verify(token) {
  return jwt.verify(token, SECRET);
}