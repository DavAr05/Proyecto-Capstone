// Cliente de la API del alumno (demo): /api/v1/student/*. El proxy de Vite
// (vite.config.js) lo envía al backend en el puerto 4000; así el teléfono solo
// necesita llegar al puerto de esta app.
const BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1/student';
const KEY = 'aprueba_alumno_token';

export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* sin storage */ } };

async function http(method, path, body) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json?.error?.message || `Error ${res.status}`);
    e.status = res.status; e.code = json?.error?.code; e.details = json?.error?.details;
    throw e;
  }
  return json.data;
}

const enc = encodeURIComponent;

export const api = {
  students: () => http('GET', '/users'),
  login: (userId) => http('POST', '/login', { userId }),
  me: () => http('GET', '/me'),
  today: () => http('GET', '/today'),
  profile: () => http('GET', '/profile'),
  saveProfile: (data) => http('PUT', '/profile', data),
  nextQuestion: (q = '') => http('GET', `/questions/next${q}`),
  answer: (id, chosen, ms) => http('POST', `/questions/${enc(id)}/answer`, { chosen, ms }),
  correction: (id, data) => http('POST', `/questions/${enc(id)}/correction`, data),
  medals: () => http('GET', '/medals'),
  exchange: (from) => http('POST', '/medals/exchange', { from }),
  benefits: () => http('GET', '/benefits'),
  redeem: (benefitId) => http('POST', `/benefits/${enc(benefitId)}/redeem`, { requestId: crypto.randomUUID() }),
  redemptions: () => http('GET', '/redemptions'),
  plans: () => http('GET', '/plans'),
  subscription: () => http('GET', '/subscription'),
  checkout: (planId, interval) => http('POST', '/subscription/checkout', { planId, interval, origin: window.location.origin }),
  paySession: (id) => http('GET', `/subscription/session/${enc(id)}`),
  mockPay: (data) => http('POST', '/subscription/mock-pay', data),
  confirmPayment: (sessionId) => http('POST', '/subscription/confirm', { sessionId }),
  cancelSubscription: () => http('POST', '/subscription/cancel'),
  resumeSubscription: () => http('POST', '/subscription/resume'),
  tickets: () => http('GET', '/tickets'),
  createTicket: (data) => http('POST', '/tickets', data),
};
