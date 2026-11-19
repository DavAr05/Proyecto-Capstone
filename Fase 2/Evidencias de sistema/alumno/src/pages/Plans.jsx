import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Sheet, useToast } from '../components/ui.jsx';

export const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
const BRAND = { visa: 'VISA', mastercard: 'Mastercard', amex: 'AMEX' };
const ORDER = ['free', 'uni', 'all'];

export default function Plans() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [sub, setSub] = useState(null);
  const [interval, setInterval] = useState('monthly');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [toast, toastNode] = useToast();

  const load = () => Promise.all([api.plans(), api.subscription()]).then(([p, s]) => { setD(p); setSub(s); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function pay(planId) {
    setBusy(planId);
    try {
      const r = await api.checkout(planId, interval);
      if (r.mode === 'simulated') nav(`/pago?session=${encodeURIComponent(r.sessionId)}`);
      else window.location.href = r.url; // Stripe Checkout (modo prueba)
    } catch (e) { toast(e.message, true); setBusy(null); }
  }

  async function toggleCancel(cancel) {
    setBusy('cancel');
    try {
      await (cancel ? api.cancelSubscription() : api.resumeSubscription());
      setConfirm(false); await load(); await refresh();
      toast(cancel ? 'Listo: tu suscripción no se renovará' : 'Listo: tu suscripción seguirá activa');
    } catch (e) { toast(e.message, true); } finally { setBusy(null); }
  }

  if (err && !d) return <p className="error">{err}</p>;
  if (!d || !sub) return <p className="center">Cargando…</p>;
  const s = sub.subscription;
  const plans = [...d.plans].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  return (
    <section>
      <div className="page-h"><h2>Planes</h2></div>

      {s && (
        <div className="card tint-blue">
          <div className="between"><h3>Tu suscripción</h3><span className="chip">{s.cancelAtPeriodEnd ? 'Se cancela' : 'Activa'}</span></div>
          <div className="plan-price" style={{ marginTop: 4 }}>{s.planName}</div>
          <p className="muted">{money(s.amount)} USD · pago {s.interval === 'yearly' ? 'anual' : 'mensual'}</p>
          <div className="divider" />
          <div className="kv"><span>{s.cancelAtPeriodEnd ? 'Acceso hasta' : 'Próximo cobro'}</span><b>{fmtDate(s.currentPeriodEnd)}</b></div>
          {s.paymentMethod && (
            <div className="kv"><span>Medio de pago</span><b className="pm"><span className="brandpill">{BRAND[s.paymentMethod.brand] || s.paymentMethod.brand}</span> •••• {s.paymentMethod.last4}</b></div>
          )}
          <div className="kv"><span>Procesado por</span><b>Stripe{sub.mode === 'simulated' ? ' (modo prueba simulado)' : ' (modo prueba)'}</b></div>
          {s.cancelAtPeriodEnd
            ? <button className="btn block" style={{ marginTop: 12 }} disabled={busy === 'cancel'} onClick={() => toggleCancel(false)}>Reanudar suscripción</button>
            : <button className="btn sec block" style={{ marginTop: 12 }} onClick={() => setConfirm(true)}>Cancelar suscripción</button>}
        </div>
      )}

      <div className="seg" role="radiogroup" aria-label="Período de pago">
        <button role="radio" aria-checked={interval === 'monthly'} className={interval === 'monthly' ? 'on' : ''} onClick={() => setInterval('monthly')}>Mensual</button>
        <button role="radio" aria-checked={interval === 'yearly'} className={interval === 'yearly' ? 'on' : ''} onClick={() => setInterval('yearly')}>Anual · ahorra</button>
      </div>

      {plans.map((p) => {
        const price = interval === 'yearly' ? p.yearly : p.monthly;
        const isFree = p.id === 'free';
        const current = isFree ? !s : s?.planId === p.id && s.interval === interval;
        const sameOtherInterval = !isFree && s?.planId === p.id && s.interval !== interval;
        const saving = p.yearly && p.monthly ? Math.round((1 - p.yearly / (p.monthly * 12)) * 100) : 0;
        return (
          <div key={p.id} className={`card plan ${p.popular ? 'tint-orange' : ''} ${current ? 'cur' : ''}`}>
            <div className="between">
              <h3>{p.name}</h3>
              {current ? <span className="chip">Tu plan</span> : p.popular ? <span className="chip">Más elegido</span> : null}
            </div>
            <div className="plan-price">{isFree ? 'Gratis' : `$${price}`}{!isFree && <small> USD/{interval === 'yearly' ? 'año' : 'mes'}</small>}</div>
            {interval === 'yearly' && saving > 0 && <div className="muted" style={{ color: 'var(--ok)', fontWeight: 800 }}>Ahorras un {saving}% al año</div>}
            <ul className="list plan-feats">
              <li>✓ {p.qDay === 0 ? 'Preguntas ilimitadas' : `Hasta ${p.qDay} preguntas al día`}</li>
              <li>✓ {p.tests >= 99 ? 'Todas las pruebas PAES' : `${p.tests} prueba${p.tests === 1 ? '' : 's'} a elección`}</li>
              {!isFree && <li>✓ Cancela cuando quieras</li>}
            </ul>
            {isFree
              ? <button className="btn sec block" disabled>{current ? 'Tu plan actual' : 'Plan gratuito'}</button>
              : <button className={`btn block ${current ? 'sec' : ''}`} disabled={current || busy === p.id} onClick={() => pay(p.id)}>
                {current ? 'Tu plan actual' : busy === p.id ? 'Abriendo Stripe…' : sameOtherInterval ? `Cambiar a pago ${interval === 'yearly' ? 'anual' : 'mensual'}` : s ? 'Cambiar a este plan' : 'Pagar con Stripe'}
              </button>}
          </div>
        );
      })}
      <p className="muted" style={{ textAlign: 'center', margin: '4px 0 12px' }}>🔒 Pagos seguros con Stripe · {sub.mode === 'simulated' ? 'modo de prueba (no se cobra dinero real)' : 'modo de prueba'}</p>

      {confirm && (
        <Sheet title="¿Cancelar suscripción?" onClose={() => setConfirm(false)}>
          <p className="muted" style={{ margin: '6px 0 14px' }}>No se te cobrará de nuevo. Mantienes tu plan hasta el {fmtDate(s.currentPeriodEnd)} y después pasas al plan gratis.</p>
          <button className="btn block" disabled={busy === 'cancel'} onClick={() => toggleCancel(true)}>{busy === 'cancel' ? 'Cancelando…' : 'Sí, cancelar'}</button>
          <button className="btn sec block" style={{ marginTop: 10 }} onClick={() => setConfirm(false)}>Mantener mi plan</button>
        </Sheet>
      )}
      {toastNode}
    </section>
  );
}
