// Cliente mínimo de la API REST de Stripe (sin dependencias: usa fetch).
// Modo real: se activa con STRIPE_SECRET_KEY=sk_test_... (solo se aceptan claves de PRUEBA).
// Sin clave => modo simulado (ver student-billing.js), con las tarjetas de prueba de Stripe.
const KEY = () => process.env.STRIPE_SECRET_KEY || '';

export const stripeEnabled = () => /^sk_test_/.test(KEY());
export const stripeMode = () => (stripeEnabled() ? 'stripe_test' : 'simulated');

// Convierte un objeto anidado a x-www-form-urlencoded al estilo de Stripe: a[b][c]=1, a[]=x
function form(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'object' ? form(x, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[]`)}=${encodeURIComponent(x)}`)));
    else if (typeof v === 'object') form(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out;
}

async function call(method, path, body) {
  if (!stripeEnabled()) throw new Error('Stripe no está configurado (STRIPE_SECRET_KEY de prueba)');
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body ? form(body).join('&') : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json?.error?.message || `Stripe ${res.status}`);
    e.stripe = json?.error; e.status = res.status;
    throw e;
  }
  return json;
}

// Checkout hospedado por Stripe para una suscripción (precio definido al vuelo, sin crear productos antes).
export function createCheckoutSession({ userId, email, planId, planName, interval, amount, successUrl, cancelUrl }) {
  const meta = { userId, planId, interval };
  return call('POST', '/checkout/sessions', {
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: email,
    client_reference_id: userId,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd', unit_amount: amount,
        recurring: { interval: interval === 'yearly' ? 'year' : 'month' },
        product_data: { name: `Aprueba · ${planName}` },
      },
    }],
    metadata: meta,
    subscription_data: { metadata: meta },
  });
}

export const retrieveCheckoutSession = (id) =>
  call('GET', `/checkout/sessions/${encodeURIComponent(id)}?expand[]=subscription.default_payment_method&expand[]=customer`);

export const retrieveSubscription = (id) =>
  call('GET', `/subscriptions/${encodeURIComponent(id)}?expand[]=default_payment_method`);

export const setCancelAtPeriodEnd = (id, cancel) =>
  call('POST', `/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: cancel ? 'true' : 'false' });
