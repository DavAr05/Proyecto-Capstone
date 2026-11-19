import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../api/client.js';
import { useLiveRefresh, LiveDelta, adj } from '../components/LiveFeed.jsx';
import {
  Card, Loading, ErrorBox, EmptyState, Select, Modal, TopKpiCard,
  IconUsers, IconWallet, IconTrendingUp, IconAlertTriangle,
} from '../components/ui.jsx';

const usd = (c) => `$${((c || 0) / 100).toFixed(2)}`;
const BRAND = { visa: 'VISA', mastercard: 'Mastercard', amex: 'AMEX' };

export default function Subscriptions({ ctx }) {
  const { L, fmt } = ctx;
  const isEn = ctx.lang === 'en';
  const t = (es, en) => (isEn ? en : es);
  const dFmt = (iso) => (iso ? new Date(iso).toLocaleDateString(isEn ? 'en-US' : 'es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
  const dtFmt = (iso) => (iso ? new Date(iso).toLocaleString(isEn ? 'en-US' : 'es-CL') : '—');

  const [rows, setRows] = useState(null);
  const [sum, setSum] = useState(null);
  const [err, setErr] = useState(null);
  const [f, setF] = useState({ status: '', plan: '', q: '' });
  const [qInput, setQInput] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await api.get(`/subscriptions${qs(f)}`);
      setRows(r.data); setSum(r.meta?.summary || null);
    } catch (e) { setErr(e.message); }
  }, [f]);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  useEffect(() => {
    const id = setTimeout(() => setF((x) => ({ ...x, q: qInput })), 300);
    return () => clearTimeout(id);
  }, [qInput]);

  async function openDetail(id) {
    try { setDetail((await api.get(`/subscriptions/${id}`)).data); } catch (e) { setErr(e.message); }
  }

  const statusTag = (s) => {
    if (s.status === 'active' && s.cancelAtPeriodEnd) return <span className="tag w">{t('Se cancela', 'Canceling')}</span>;
    if (s.status === 'active') return <span className="tag g">{t('Activa', 'Active')}</span>;
    if (s.status === 'past_due') return <span className="tag w">{t('Pago pendiente', 'Past due')}</span>;
    return <span className="tag d">{t('Cancelada', 'Canceled')}</span>;
  };
  const card = (pm) => (pm ? (
    <span><span className="tag">{BRAND[pm.brand] || pm.brand}</span> •••• {pm.last4}{pm.expMonth ? <span className="note"> · {t('vence', 'exp')} {String(pm.expMonth).padStart(2, '0')}/{String(pm.expYear).slice(-2)}</span> : null}</span>
  ) : <span className="note">—</span>);
  const interval = (s) => (s.interval === 'yearly' ? t('Anual', 'Yearly') : t('Mensual', 'Monthly'));
  const provider = (s) => (s.provider === 'stripe' ? 'Stripe' : t('Stripe (simulado)', 'Stripe (simulated)'));

  if (err && !rows) return <Card><ErrorBox msg={err} onRetry={load} L={L} /></Card>;
  if (!rows || !sum) return <Loading L={L} />;

  return (
    <>
      <p className="sub" style={{ marginBottom: 12 }}>
        {t('Alumnos con suscripción de pago, su medio de pago en Stripe y el historial de cobros.', 'Students with paid subscriptions, their Stripe payment method and billing history.')}
      </p>

      <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 12, background: sum.mode === 'simulated' ? 'var(--deg-bg)' : 'var(--ok-bg)', fontSize: 13 }}>
        {sum.mode === 'simulated'
          ? t('Stripe en modo simulado (sin claves): los pagos usan tarjetas de prueba y no mueven dinero. Para conectar Stripe real en modo prueba agrega STRIPE_SECRET_KEY=sk_test_… en backend/.env.', 'Stripe in simulated mode (no keys): payments use test cards and move no money. To connect real Stripe test mode add STRIPE_SECRET_KEY=sk_test_… to backend/.env.')
          : t('Conectado a Stripe en modo prueba. Los pagos se procesan en Stripe Checkout.', 'Connected to Stripe test mode. Payments are processed via Stripe Checkout.')}
      </div>

      <div className="grid g4">
        <TopKpiCard icon={IconUsers} tone="blue" label={t('Suscripciones activas', 'Active subscriptions')} value={<>{fmt(adj('active-subs', sum.active))}<LiveDelta id="active-subs" value={sum.active} /></>} delta={sum.canceling ? `${sum.canceling} ${t('se cancelan', 'canceling')}` : null} />
        <TopKpiCard icon={IconTrendingUp} tone="green" label={t('Ingreso mensual recurrente', 'Monthly recurring revenue')} value={usd(sum.mrr)} />
        <TopKpiCard icon={IconWallet} tone="purple" label={t('Cobrado este mes', 'Charged this month')} value={usd(sum.revenueMonth)} delta={`${t('Total', 'Total')} ${usd(sum.revenueTotal)}`} />
        <TopKpiCard icon={IconAlertTriangle} tone="orange" label={t('Pagos fallidos', 'Failed payments')} value={fmt(sum.failedPayments)} />
      </div>

      {sum.byPlan.length > 0 && (
        <Card style={{ marginTop: 14 }}>
          <b>{t('Distribución por plan', 'Distribution by plan')}</b>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
            {sum.byPlan.map((p) => (
              <div key={p.planId} style={{ flex: '1 1 180px', padding: '10px 14px', borderRadius: 12, background: 'var(--soft)' }}>
                <div className="note">{p.planName}</div>
                <b style={{ fontSize: 20 }}>{p.count}</b> <span className="note">{t('suscriptores', 'subscribers')} · {usd(p.mrr)}/{t('mes', 'mo')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ marginTop: 14 }}>
        <div className="filters">
          <Select value={f.status} onChange={(v) => setF((x) => ({ ...x, status: v }))} placeholder={`${t('Estado', 'Status')}: ${t('Todos', 'All')}`}
            options={[{ value: 'active', label: t('Activas', 'Active') }, { value: 'canceling', label: t('Se cancelan', 'Canceling') }, { value: 'canceled', label: t('Canceladas', 'Canceled') }]} />
          <Select value={f.plan} onChange={(v) => setF((x) => ({ ...x, plan: v }))} placeholder={`${t('Plan', 'Plan')}: ${t('Todos', 'All')}`}
            options={[{ value: 'uni', label: t('1 prueba ilimitada', '1 test unlimited') }, { value: 'all', label: t('Todas las pruebas', 'All tests') }]} />
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={t('Buscar alumno, correo o ID de Stripe…', 'Search student, email or Stripe ID…')} />
        </div>

        {rows.length === 0 ? <EmptyState msg={t('Aún no hay suscripciones. Cuando un alumno pague un plan en la app aparecerá aquí.', 'No subscriptions yet. When a student pays for a plan in the app it will show up here.')} /> : (
          <div className="tbl-wrap cards-m"><table>
            <thead><tr>
              <th>{t('Alumno', 'Student')}</th><th>{t('Plan', 'Plan')}</th><th>{t('Estado', 'Status')}</th>
              <th>{t('Medio de pago (Stripe)', 'Payment method (Stripe)')}</th><th>{t('Próximo cobro / vence', 'Next charge / ends')}</th>
              <th>{t('Monto', 'Amount')}</th><th>{t('Desde', 'Since')}</th><th />
            </tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.id}>
                <td className="cell-main"><b>{s.userName}</b><div className="note">{s.userEmail}</div></td>
                <td data-label={t('Plan', 'Plan')}>{s.planName}<div className="note">{interval(s)}</div></td>
                <td data-label={t('Estado', 'Status')}>{statusTag(s)}</td>
                <td data-label={t('Medio de pago', 'Payment method')}>{card(s.paymentMethod)}<div className="note">{provider(s)}{s.stripeCustomerId ? ` · ${s.stripeCustomerId}` : ''}</div></td>
                <td data-label={t('Próximo cobro', 'Next charge')}>{dFmt(s.currentPeriodEnd)}<div className="note">{s.status !== 'active' ? t('Finalizada', 'Ended') : s.cancelAtPeriodEnd ? t('No se renueva', 'Won’t renew') : t('Renovación automática', 'Auto-renews')}</div></td>
                <td data-label={t('Monto', 'Amount')}><b>{usd(s.amount)}</b><div className="note">USD / {s.interval === 'yearly' ? t('año', 'yr') : t('mes', 'mo')}</div></td>
                <td data-label={t('Desde', 'Since')}>{dFmt(s.createdAt)}</td>
                <td className="cell-actions"><div className="row-acts"><button className="btn sec sm" onClick={() => openDetail(s.id)}>{t('Ver detalle', 'Details')}</button></div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {err && <ErrorBox msg={err} onRetry={load} L={L} />}
      </Card>

      {detail && (
        <Modal wide title={detail.userName} subtitle={`${detail.planName} · ${interval(detail)}`} onClose={() => setDetail(null)}
          footer={<button className="btn sec" onClick={() => setDetail(null)}>{t('Cerrar', 'Close')}</button>}>
          <div className="grid g2" style={{ gap: 14 }}>
            <div>
              <b>{t('Suscripción', 'Subscription')}</b>
              <dl className="kvl">
                <dt>{t('Estado', 'Status')}</dt><dd>{statusTag(detail)}</dd>
                <dt>{t('Monto', 'Amount')}</dt><dd>{usd(detail.amount)} USD / {detail.interval === 'yearly' ? t('año', 'yr') : t('mes', 'mo')}</dd>
                <dt>{t('Período actual', 'Current period')}</dt><dd>{dFmt(detail.currentPeriodStart)} → {dFmt(detail.currentPeriodEnd)}</dd>
                <dt>{t('Contratada', 'Started')}</dt><dd>{dtFmt(detail.createdAt)}</dd>
                {detail.canceledAt && <><dt>{t('Cancelación pedida', 'Cancellation requested')}</dt><dd>{dtFmt(detail.canceledAt)}</dd></>}
                {detail.endedAt && <><dt>{t('Finalizada', 'Ended')}</dt><dd>{dtFmt(detail.endedAt)}</dd></>}
              </dl>
            </div>
            <div>
              <b>Stripe</b>
              <dl className="kvl">
                <dt>{t('Modo', 'Mode')}</dt><dd>{provider(detail)}</dd>
                <dt>{t('Medio de pago', 'Payment method')}</dt><dd>{card(detail.paymentMethod)}</dd>
                <dt>Customer</dt><dd><code>{detail.stripeCustomerId || '—'}</code></dd>
                <dt>Subscription</dt><dd><code>{detail.stripeSubscriptionId || '—'}</code></dd>
                <dt>Checkout</dt><dd><code>{detail.stripeSessionId || '—'}</code></dd>
                <dt>{t('Alumno', 'Student')}</dt><dd>{detail.userEmail} <span className="note">({detail.userId})</span></dd>
              </dl>
            </div>
          </div>

          <b style={{ display: 'block', margin: '16px 0 6px' }}>{t('Historial de cobros', 'Billing history')}</b>
          {detail.payments.length === 0 ? <EmptyState msg={t('Sin cobros registrados', 'No charges recorded')} /> : (
            <div className="tbl-wrap"><table>
              <thead><tr><th>{t('Fecha', 'Date')}</th><th>{t('Resultado', 'Result')}</th><th>{t('Tipo', 'Type')}</th><th>{t('Monto', 'Amount')}</th><th>{t('Detalle', 'Detail')}</th></tr></thead>
              <tbody>{detail.payments.map((p) => (
                <tr key={p.id}>
                  <td>{dtFmt(p.createdAt)}</td>
                  <td>{p.status === 'succeeded' ? <span className="tag g">{t('Exitoso', 'Succeeded')}</span> : <span className="tag d">{t('Fallido', 'Failed')}</span>}</td>
                  <td>{p.kind === 'renewal' ? t('Renovación', 'Renewal') : t('Primer cobro', 'Initial')}</td>
                  <td><b>{usd(p.amount)}</b></td>
                  <td className="note">{p.status === 'failed' ? `${p.failureReason || ''} (${p.failureCode})` : card(p.paymentMethod)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Modal>
      )}
    </>
  );
}
