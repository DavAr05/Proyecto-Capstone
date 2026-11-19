import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { money } from './Plans.jsx';

// Tarjetas de prueba de Stripe (se pueden tocar para rellenar el formulario).
const TEST = [
  ['4242 4242 4242 4242', 'Pago exitoso (Visa)'],
  ['5555 5555 5555 4444', 'Pago exitoso (Mastercard)'],
  ['4000 0000 0000 0002', 'Tarjeta rechazada'],
  ['4000 0000 0000 9995', 'Fondos insuficientes'],
];

const groups = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const expFmt = (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d; };

function Done({ sub, onGo }) {
  return (
    <div className="card center pay-done">
      <div className="okmark" aria-hidden="true">✓</div>
      <h2 style={{ fontSize: 26 }}>¡Pago exitoso!</h2>
      <p className="muted" style={{ margin: '6px 0 14px' }}>Ya tienes el plan <b>{sub.planName}</b>. {sub.interval === 'yearly' ? 'Se renueva cada año.' : 'Se renueva cada mes.'}</p>
      <button className="btn block" onClick={onGo}>Ver mi plan</button>
    </div>
  );
}

// /pago?session=...  → Stripe simulado (modo prueba, sin claves).
// /pago/exito?session_id=... → regreso desde Stripe Checkout real (modo prueba).
export default function Pay({ returning = false }) {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [qs] = useSearchParams();
  const sid = qs.get(returning ? 'session_id' : 'session');
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ number: '', exp: '', cvc: '', name: user.name });

  useEffect(() => {
    if (!sid) { setErr('No encontré la sesión de pago.'); return; }
    if (returning) {
      api.confirmPayment(sid).then(async (r) => { await refresh(); setDone(r.subscription); }).catch((e) => setErr(e.message));
    } else {
      api.paySession(sid).then(setInfo).catch((e) => setErr(e.message));
    }
  }, [sid, returning]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api.mockPay({ sessionId: sid, ...f });
      await refresh(); setDone(r.subscription);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  if (done) return <Done sub={done} onGo={() => nav('/planes', { replace: true })} />;
  if (returning) return err ? <div className="card"><p className="error">{err}</p><Link className="btn block" to="/planes">Volver a planes</Link></div> : <p className="center">Confirmando tu pago con Stripe…</p>;
  if (!info) return err ? <div className="card"><p className="error">{err}</p><Link className="btn block" to="/planes">Volver a planes</Link></div> : <p className="center">Cargando…</p>;
  if (info.status === 'complete') return <div className="card center"><p>Este pago ya fue completado.</p><Link className="btn block" to="/planes">Ver mi plan</Link></div>;
  if (info.expired) return <div className="card center"><p>La sesión de pago expiró.</p><Link className="btn block" to="/planes">Elegir plan</Link></div>;

  const total = money(info.amount);
  return (
    <section>
      <div className="page-h"><h2>Pagar</h2><span className="chip">Modo de prueba</span></div>

      <div className="card tint-blue">
        <div className="muted">Aprueba · suscripción {info.interval === 'yearly' ? 'anual' : 'mensual'}</div>
        <h3 style={{ fontSize: 22 }}>{info.planName}</h3>
        <div className="plan-price">{total}<small> USD/{info.interval === 'yearly' ? 'año' : 'mes'}</small></div>
      </div>

      <form className="card" onSubmit={submit} autoComplete="off">
        <div className="between"><h3>Pago con tarjeta</h3><span className="stripe-tag">stripe</span></div>
        <label className="f">Correo<input value={info.email} readOnly /></label>
        <label className="f">Número de tarjeta
          <input inputMode="numeric" placeholder="1234 1234 1234 1234" value={f.number} onChange={(e) => setF({ ...f, number: groups(e.target.value) })} required />
        </label>
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <label className="f grow">Vencimiento<input inputMode="numeric" placeholder="MM / AA" value={f.exp} onChange={(e) => setF({ ...f, exp: expFmt(e.target.value) })} required /></label>
          <label className="f grow">CVC<input inputMode="numeric" placeholder="123" maxLength={4} value={f.cvc} onChange={(e) => setF({ ...f, cvc: e.target.value.replace(/\D/g, '') })} required /></label>
        </div>
        <label className="f">Nombre en la tarjeta<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn block" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Procesando…' : `Pagar ${total}`}</button>
        <p className="muted" style={{ textAlign: 'center', marginTop: 10 }}>🔒 Conexión segura · No se cobra dinero real</p>
      </form>

      <div className="card">
        <h3>Tarjetas de prueba</h3>
        <p className="muted" style={{ marginBottom: 8 }}>Toca una para rellenar el formulario (cualquier fecha futura y cualquier CVC).</p>
        {TEST.map(([n, label]) => (
          <button key={n} type="button" className="testcard" onClick={() => setF({ ...f, number: n, exp: '12 / 34', cvc: '123' })}>
            <b>{n}</b><span className="muted">{label}</span>
          </button>
        ))}
      </div>
      <Link className="btn ghost block" to="/planes">← Volver a planes</Link>
    </section>
  );
}
