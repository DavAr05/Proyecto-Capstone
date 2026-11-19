import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Medal, useToast } from '../components/ui.jsx';
import { SponsorArt, SponsorHero, sponsorTheme } from '../components/SponsorArt.jsx';

const fmtDate = (iso) => new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Comprobante que aparece al canjear: pantalla completa con el estilo del sponsor.
function Voucher({ v, onClose }) {
  return (
    <div className="voucher-scrim" role="dialog" aria-modal="true" aria-label="Beneficio canjeado">
      <div className="voucher">
        <SponsorHero name={v.sponsorName}>
          <span className="pill-tag">{sponsorTheme(v.sponsorName).label}</span>
          <h2 className="vh">¡Beneficio canjeado!</h2>
          <p className="vs">{v.sponsorName}</p>
        </SponsorHero>
        <div className="voucher-body">
          <h3 className="vb">{v.benefitName}</h3>
          <div className="voucher-cost"><Medal tier="platinum" size="sm">◆</Medal> <b>{v.cost}</b> platino usado</div>
          <div className="voucher-code">
            <span>Código de canje</span>
            <b>{v.coupon}</b>
          </div>
          <p className="muted vdate">{fmtDate(v.at)}</p>
          <p className="muted vnote">Muestra este código en {v.sponsorName} para usar tu beneficio.</p>
          <button className="btn block" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}

// Tarjeta por sponsor: se abre para ver sus beneficios, cuánto cuestan y el botón de canje.
function SponsorCard({ name, items, plat, open, onToggle, busy, onRedeem }) {
  const stockLeft = items.reduce((a, b) => a + (b.stock === null ? Infinity : b.stock), 0);
  return (
    <div className={`sp-card ${open ? 'open' : ''}`}>
      <button className="sp-head" onClick={onToggle} aria-expanded={open}>
        <SponsorArt name={name} size={52} />
        <span className="grow">
          <b>{name}</b>
          <span className="muted">{items.length} beneficio{items.length === 1 ? '' : 's'} · {stockLeft === Infinity ? 'stock ilimitado' : `${stockLeft} disponibles`}</span>
        </span>
        <span className="chev" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="sp-body">
          {items.map((b) => {
            const short = plat < b.costPlatinum;
            const out = b.stock === 0;
            return (
              <div key={b.id} className="ben-row">
                <div className="grow">
                  <b>{b.name}</b>
                  <div className="muted">{b.description || 'Beneficio exclusivo para alumnos'}</div>
                  <div className="ben-meta"><Medal tier="platinum" size="sm">◆</Medal> <b>{b.costPlatinum}</b> <span>· {b.stock === null ? 'ilimitado' : `quedan ${b.stock}`}</span></div>
                </div>
                <button className="btn sm" disabled={short || out || busy === b.id} onClick={() => onRedeem(b)}>
                  {out ? 'Agotado' : short ? 'Te faltan' : busy === b.id ? 'Canjeando…' : 'Canjear'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Benefits() {
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState('sponsors');
  const [items, setItems] = useState(null);
  const [mine, setMine] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState({});
  const [voucher, setVoucher] = useState(null);
  const [toast, toastNode] = useToast();

  const load = () => {
    api.benefits().then(setItems).catch((e) => setErr(e.message));
    api.redemptions().then(setMine).catch((e) => setErr(e.message));
  };
  useEffect(() => { load(); }, []);

  // Agrupa los beneficios por sponsor
  const groups = useMemo(() => {
    const map = new Map();
    for (const b of items || []) {
      if (!map.has(b.sponsorId)) map.set(b.sponsorId, { id: b.sponsorId, name: b.sponsorName || 'Sponsor', items: [] });
      map.get(b.sponsorId).items.push(b);
    }
    return [...map.values()];
  }, [items]);

  async function redeem(b) {
    setBusy(b.id);
    try {
      const r = await api.redeem(b.id);
      setUser(r.user);
      setVoucher({
        sponsorName: b.sponsorName || 'Sponsor', benefitName: b.name, cost: b.costPlatinum,
        coupon: r.redemption.couponCode, at: r.redemption.createdAt || new Date().toISOString(),
      });
      load();
    } catch (e) { toast(e.message, true); } finally { setBusy(null); }
  }

  if (err && !items) return <p className="error">{err}</p>;
  if (!items || !mine) return <p className="center">Cargando…</p>;
  const plat = user.medals.platinum;

  return (
    <section>
      <div className="page-h"><h2>Beneficios</h2></div>
      <p className="muted" style={{ marginBottom: 10 }}>Toca un sponsor para ver sus beneficios y canjearlos con tu platino.</p>
      <div className="seg">
        <button className={tab === 'sponsors' ? 'on' : ''} onClick={() => setTab('sponsors')}>Por sponsor</button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>Mis canjes ({mine.length})</button>
      </div>

      {tab === 'sponsors' && (groups.length === 0 ? <p className="center">No hay beneficios disponibles.</p> : groups.map((g) => (
        <SponsorCard key={g.id} name={g.name} items={g.items} plat={plat}
          open={!!open[g.id]} onToggle={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}
          busy={busy} onRedeem={redeem} />
      )))}

      {tab === 'mine' && (mine.length === 0 ? <p className="center">Aún no has canjeado nada.</p> : mine.map((r) => (
        <div key={r.id} className="mine-row">
          <SponsorArt name={items.find((b) => b.sponsorId === r.sponsorId)?.sponsorName || r.benefitName} size={46} />
          <div className="grow">
            <b>{r.benefitName}</b>
            <div className="muted">{fmtDate(r.createdAt)} · ◆ {r.platinumSpent}</div>
          </div>
          <span className="coupon">{r.couponCode}</span>
        </div>
      )))}

      {voucher && <Voucher v={voucher} onClose={() => setVoucher(null)} />}
      {toastNode}
    </section>
  );
}
