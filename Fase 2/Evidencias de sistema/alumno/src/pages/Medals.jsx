import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Medal, TIERS, TIER_NAME, useToast } from '../components/ui.jsx';

const REASON = {
  daily_login: 'Inicio de sesión diario', correct_answer: 'Respuesta correcta', benefit_redeemed: 'Canje de beneficio',
  demo_balance_set: 'Ajuste de saldo', correction_confirmed: 'Recorrección confirmada',
};
const reasonText = (h) => REASON[h.reason] || (h.reason?.startsWith('exchange') ? 'Canje de medallas' : h.reason || h.event);

export default function Medals() {
  const { setUser } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(null);
  const [toast, toastNode] = useToast();

  const load = () => api.medals().then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function exchange(from, to) {
    setBusy(from);
    try {
      const r = await api.exchange(from);
      setUser((u) => ({ ...u, medals: r.medals }));
      toast(`Canjeaste ${d.rate} de ${TIER_NAME[from]} por 1 de ${TIER_NAME[to]}`);
      await load();
    } catch (e) { toast(e.message, true); } finally { setBusy(null); }
  }

  if (err) return <p className="error">{err}</p>;
  if (!d) return <p className="center">Cargando…</p>;
  const total = TIERS.reduce((a, t) => a + d.medals[t], 0);

  return (
    <section>
      <div className="page-h"><h2>Mis medallas</h2><span className="sub">Total: {total}</span></div>
      {TIERS.map((t, i) => {
        const next = TIERS[i + 1];
        const have = d.medals[t];
        return (
          <div className="card tier-card" key={t}>
            <Medal tier={t} size="lg" />
            <div className="meta">
              <b>{TIER_NAME[t]}</b> <span className="muted">· {have}</span>
              {next ? (
                <>
                  <div className="bar" style={{ margin: '6px 0 3px' }}><i style={{ width: `${Math.min(100, (have % d.rate) / d.rate * 100 + (have >= d.rate ? 0 : 0))}%` }} /></div>
                  <span className="muted">{have % d.rate}/{d.rate} para la siguiente ({TIER_NAME[next]})</span>
                </>
              ) : <div className="muted">Nivel máximo · se canjea por beneficios</div>}
            </div>
            {next && <button className="btn sm" disabled={have < d.rate || busy === t} onClick={() => exchange(t, next)}>Canjear</button>}
          </div>
        );
      })}
      <div className="card">
        <h3>Actividad reciente</h3>
        {d.history.length === 0 && <p className="muted">Aún no hay movimientos.</p>}
        {d.history.map((h) => (
          <div className="between" key={h.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
            <div className="row"><Medal tier={h.tier} size="sm" /><div><div>{reasonText(h)}</div><div className="muted">{new Date(h.createdAt).toLocaleString('es-CL')}</div></div></div>
            <b style={{ color: h.amount >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{h.amount > 0 ? '+' : ''}{h.amount}</b>
          </div>
        ))}
      </div>
      {toastNode}
    </section>
  );
}
