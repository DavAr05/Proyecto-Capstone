import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useLiveRefresh, LiveDelta, adj } from '../components/LiveFeed.jsx';
import { Card, StatusPill, Loading, LineChartInteractive, Funnel, DonutMulti, ErrorBox, IconDownload, IconInfo, IconUsers, IconMedal, KpiTile } from '../components/ui.jsx';

const PLAN_LABEL = { uni: { es: '1 prueba', en: 'One test' }, all: { es: 'Todas las pruebas', en: 'All tests' } };

// ── Iconos SVG nítidos de fondo ──
function IconDownloadBig({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconUsersBig({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconStarBig({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconCashBig({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
    </svg>
  );
}

// Iconos de cabecera de las tarjetas
function IconMonitor({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function IconFunnel({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" />
    </svg>
  );
}

function IconArrowUpRight({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

function IconRevenueBars({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M5.5 19v-5.2" />
      <path d="M12 19V9.5" />
      <path d="M18.5 19V4.8" />
    </svg>
  );
}

// Icono decorativo de Sponsors (apretón de manos)
function IconHandshakeBig({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3 1 11h-2" />
      <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
      <path d="M3 4h8" />
    </svg>
  );
}

function IconBadgeMedalBig({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="m8.21 13.89-1.21 7.11 5-3 5 3-1.21-7.11" />
    </svg>
  );
}

// Cabecera común: icono azul + título, con acciones opcionales a la derecha.
function CardHead({ icon: IconComponent, title, right }) {
  return (
    <div className="ov-head">
      <span className="ov-head-ic"><IconComponent size={18} /></span>
      <b className="ov-head-title">{title}</b>
      {right && <div className="ov-head-right">{right}</div>}
    </div>
  );
}

// ── Tarjeta "Recaudación por plan" ──
// Dos paneles celestes, cada uno con su etiqueta, monto y barra de avance.
function RevenuePlanCard({ title, data, onOpen, moreLabel }) {
  const max = Math.max(...data.map((p) => p.value || 0), 0) || 1;
  return (
    <Card className="rev-plan-card">
      <div className="ov-head">
        <span className="ov-head-ic"><IconRevenueBars /></span>
        <b className="ov-head-title">{title}</b>
        <div className="ov-head-right">
          <button type="button" className="rev-plan-info" onClick={onOpen} aria-label={moreLabel} title={moreLabel}>
            <IconInfo size={17} />
          </button>
        </div>
      </div>
      <div className="rev-plan-plans">
        {data.map((p) => {
          const frac = p.value > 0 ? Math.max(0.06, p.value / max) : 0.04;
          return (
            <div className="rev-plan-plan" key={p.key || p.label}>
              <span className="rev-plan-label">{p.label}</span>
              <b className="rev-plan-amount">{p.disp}</b>
              <span className="rev-plan-track">
                <span className="rev-plan-bar" style={{ width: `${Math.round(frac * 100)}%` }} />
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── KPI superior ──
// Caja de icono a la izquierda y etiqueta, valor y variación a la derecha.
function TopKpiCard({ label, value, delta, icon: IconComponent }) {
  return <KpiTile label={label} value={value} delta={delta} icon={IconComponent} />;
}

// ── KPI lateral (Sponsors activos / Badges emitidos) ──
function SideKpiCard({ label, value, delta, icon: IconComponent }) {
  return <KpiTile label={label} value={value} delta={delta} icon={IconComponent} />;
}

export default function Overview({ ctx }) {
  const { L, fmt, lang } = ctx;
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [services, setServices] = useState([]);
  const [range, setRange] = useState('30d');
  const [err, setErr] = useState(null);
  const [embudoView, setEmbudoView] = useState('steps');

  const isEn = lang === 'en';

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await api.get(`/metrics/overview?range=${range}`);
      setD(res.data);

      try {
        const sRes = await api.get('/services');
        setServices(sRes.data || []);
      } catch {
        setServices([]);
      }
    } catch (e) {
      setErr(e.message);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);
  useLiveRefresh(load);

  if (err) return <Card><ErrorBox msg={err} onRetry={load} L={L} /></Card>;
  if (!d) return <Loading L={L} />;

  const revBars = (d.revenueByPlan || []).map((r) => ({
    key: r.plan,
    label: PLAN_LABEL[r.plan]?.[isEn ? 'en' : 'es'] || r.plan,
    value: r.value,
    disp: '$' + fmt(r.value),
  }));

  const thisMonthText = isEn ? 'this month' : 'este mes';
  const vsPrevText = isEn ? 'vs previous period' : 'vs. mes previo';
  const convRateText = isEn ? 'of MAU converted' : 'de MAU convertidos';
  const convPct = d.converted?.rate || 12.8;

  const updatedText = new Date().toLocaleDateString(isEn ? 'en-GB' : 'es-CL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  // Descarga el histórico de descargas por mes en CSV.
  const downloadCsv = () => {
    const rows = [['Mes', 'Descargas'], ...(d.downloadsByMonth || []).map((m) => [m.month, m.value])];
    const csv = rows.map((r) => r.join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'descargas-por-mes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Selector de rango — el título "Resumen" ya lo muestra el topbar. */}
      <div className="flex overview-layout-2 ov-range">
        <div className="flex overview-layout-3">
          {['7d', '30d', '90d'].map((r) => (
            <button
              key={r}
              type="button"
              className={`btn sm ${range === r ? 'act' : 'sec'}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPIs principales — en teléfono quedan en grilla 2x2. */}
      <div className="grid g4 ov-kpis">
        <TopKpiCard
          label={isEn ? 'Total downloads' : 'Descargas totales'}
          value={fmt(d.downloads?.total)}
          delta={`${fmt(d.downloads?.month)} ${thisMonthText}`}
          icon={IconDownloadBig}
        />
        <TopKpiCard
          label={isEn ? 'Monthly active (MAU)' : 'Activos mensuales (MAU)'}
          value={fmt(d.mau?.value)}
          delta={`${d.mau?.deltaPct || 6.4}% ${vsPrevText}`}
          icon={IconUsersBig}
        />
        <TopKpiCard
          label={isEn ? 'Converted to paid' : 'Convertidos a pago'}
          value={<>{fmt(adj('converted', d.converted?.value))}<LiveDelta id="converted" value={d.converted?.value} /></>}
          delta={`${convPct}% ${convRateText}`}
          icon={IconCashBig}
        />
        <TopKpiCard
          label={isEn ? 'Monthly revenue' : 'Recaudación mensual'}
          value={<>{`$${fmt(adj('mrr', d.mrr?.value))}`}<LiveDelta id="mrr" money value={d.mrr?.value} /></>}
          delta={`${d.mrr?.deltaPct || 9.1}% ${vsPrevText}`}
          icon={IconStarBig}
        />
      </div>

      {/* Fila intermedia: Descargas + Embudo */}
      <div className="ov-mid">
        <Card>
          <CardHead
            icon={IconDownload}
            title={isEn ? 'Downloads per month' : 'Descargas por mes'}
            right={
              <>
                <span className="ov-updated">
                  {(isEn ? 'Last updated: ' : 'Última actualización: ')}{updatedText}
                </span>
                <button
                  type="button"
                  className="ov-icon-btn"
                  onClick={downloadCsv}
                  aria-label={isEn ? 'Download data' : 'Descargar datos'}
                  title={isEn ? 'Download data' : 'Descargar datos'}
                >
                  <IconDownload size={16} />
                </button>
              </>
            }
          />
          <div className="ov-chart">
            <LineChartInteractive
              vals={(d.downloadsByMonth || []).map((m) => m.value)}
              labels={(d.downloadsByMonth || []).map((m) => m.month)}
              format={(v) => fmt(v)}
            />
          </div>
        </Card>

        <Card>
          <CardHead
            icon={IconFunnel}
            title={isEn ? 'Conversion funnel' : 'Embudo de conversión'}
            right={
              <button
                type="button"
                className="btn sec sm ov-funnel-btn"
                onClick={() => setEmbudoView((v) => (v === 'steps' ? 'circular' : 'steps'))}
              >
                {embudoView === 'steps' ? (isEn ? 'View circular' : 'Ver circular') : (isEn ? 'View steps' : 'Ver escalones')}
                <IconArrowUpRight size={14} />
              </button>
            }
          />
          <div className="overview-layout-8">
            {embudoView === 'steps' ? (
              <Funnel
                data={[
                  { label: isEn ? 'Downloads' : 'Descargas', value: d.downloads?.total || 0 },
                  { label: 'MAU', value: d.mau?.value || 0 },
                  { label: isEn ? 'Converted' : 'Convertidos', value: d.converted?.value || 0 },
                ]}
                format={(v) => fmt(v)}
              />
            ) : (
              <DonutMulti
                data={[
                  { label: isEn ? 'Downloads' : 'Descargas', value: d.downloads?.total || 0, color: 'var(--brand)', disp: fmt(d.downloads?.total || 0) },
                  { label: 'MAU', value: d.mau?.value || 0, color: 'var(--accent)', disp: fmt(d.mau?.value || 0) },
                  { label: isEn ? 'Converted' : 'Convertidos', value: d.converted?.value || 0, color: 'var(--cta)', disp: fmt(d.converted?.value || 0) },
                ]}
                centerLabel={`${convPct}%`}
              />
            )}
          </div>
        </Card>
      </div>

      {/* Fila inferior */}
      <div className="ov-bottom">
        {/* Salud del sistema */}
        <Card>
          <CardHead icon={IconMonitor} title={isEn ? 'System health' : 'Estado del sistema'} />
          <div className="ov-health">
            {services.map((s) => (
              <div key={s.id} className="ov-health-row">
                <span>{s.name && typeof s.name === 'object' ? (isEn ? s.name.en : s.name.es) : s.name}</span>
                <StatusPill state={s.state} L={L} />
              </div>
            ))}
            <div className="ov-health-link">
              <span className="note link-action" onClick={() => nav('/operativa')}>
                {isEn ? 'View detail' : 'Ver detalle'} <span className="arw">→</span>
              </span>
            </div>
          </div>
        </Card>

        {/* Recaudación por plan */}
        <RevenuePlanCard
          title={isEn ? 'Revenue by plan' : 'Recaudación por plan'}
          data={revBars}
          onOpen={() => nav('/comercial')}
          moreLabel={isEn ? 'View commercial detail' : 'Ver detalle en Comercial'}
        />

        {/* Columna derecha compacta */}
        <div className="ov-side-col">
          <SideKpiCard
            label={isEn ? 'Active sponsors' : 'Sponsors activos'}
            value={fmt(d.sponsorsActive)}
            delta="20%"
            icon={IconUsers}
            deco={IconHandshakeBig}
          />

          <SideKpiCard
            label={isEn ? 'Issued badges' : 'Badges emitidos'}
            value={fmt(d.badgesIssued)}
            delta="4%"
            icon={IconMedal}
            deco={IconBadgeMedalBig}
          />
        </div>
      </div>
    </>
  );
}
