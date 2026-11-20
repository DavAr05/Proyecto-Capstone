import { useCallback, useEffect, useRef, useState } from 'react';

export const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'platinum'];
export const TIER_NAME = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro', diamond: 'Diamante', platinum: 'Platino' };
export const TEST_NAME = { m1: 'Matemática M1', l1: 'Competencia lectora', b1: 'Biología' };
export const DIFF_NAME = { d1: 'Básico', d2: 'Intermedio', d3: 'Avanzado' };

// ── Medallas: disco con borde, brillo y un símbolo por nivel ──
const MEDAL = {
  bronze: { o: ['#F1B170', '#B86A22'], i: ['#E39A4F', '#A55B1B'], g: 'star' },
  silver: { o: ['#EEF2F8', '#8D99AE'], i: ['#C3CCDA', '#8794A9'], g: 'star' },
  gold: { o: ['#FFD76E', '#E39610'], i: ['#FBBE3A', '#E08A0E'], g: 'star' },
  diamond: { o: ['#8EDBFF', '#0B8FD6'], i: ['#47C0F7', '#0283C9'], g: 'gem' },
  platinum: { o: ['#CDBFFF', '#7439E8'], i: ['#AB8FFB', '#6A2BD6'], g: 'crown' },
};
function Glyph({ kind, tint }) {
  if (kind === 'star') return <polygon points="32,16 36.8,26.6 48.4,27.9 39.8,35.8 42.2,47.2 32,41.4 21.8,47.2 24.2,35.8 15.6,27.9 27.2,26.6" fill="#fff" opacity=".96" />;
  if (kind === 'gem') {
    return (
      <g>
        <polygon points="20,26 26,18 38,18 44,26 32,46" fill="#fff" opacity=".96" />
        <path d="M20 26H44M26 18L32 26L38 18M32 26V46" stroke={tint} strokeOpacity=".45" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      </g>
    );
  }
  return (
    <g fill="#fff" opacity=".96">
      <path d="M18 40L20 23L27.5 31L32 20L36.5 31L44 23L46 40Z" />
      <rect x="19" y="43" width="26" height="3.6" rx="1.8" />
    </g>
  );
}
export function Medal({ tier, size = '' }) {
  const m = MEDAL[tier] || MEDAL.bronze;
  return (
    <span className={`medal ${size}`} role="img" aria-label={TIER_NAME[tier]}>
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id={`mo-${tier}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={m.o[0]} /><stop offset="1" stopColor={m.o[1]} /></linearGradient>
          <linearGradient id={`mi-${tier}`} x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stopColor={m.i[0]} /><stop offset="1" stopColor={m.i[1]} /></linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill={`url(#mo-${tier})`} />
        <circle cx="32" cy="32" r="30" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
        <circle cx="32" cy="32" r="24" fill={`url(#mi-${tier})`} stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" />
        <ellipse cx="25" cy="17" rx="14" ry="6" fill="#fff" opacity=".28" transform="rotate(-25 25 17)" />
        <Glyph kind={m.g} tint={m.i[1]} />
      </svg>
    </span>
  );
}

// Gema morada del saldo de platino (encabezado).
export function Gem({ size = 38 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="gm1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#B79BFF" /><stop offset="1" stopColor="#6A2BD6" /></linearGradient>
      </defs>
      <polygon points="32,3 53,14 61,32 53,50 32,61 11,50 3,32 11,14" fill="url(#gm1)" />
      <polygon points="32,3 53,14 61,32 53,50 32,61 11,50 3,32 11,14" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" />
      <polygon points="32,16 44,26 32,46 20,26" fill="#fff" opacity=".95" />
      <path d="M20 26H44M32 16V46" stroke="#8B63F0" strokeOpacity=".5" strokeWidth="1.5" />
    </svg>
  );
}

// Hoja inferior (modal móvil). Se cierra con Esc o tocando fuera.
export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="between"><h3>{title}</h3><button className="btn ghost sm" onClick={onClose} aria-label="Cerrar">✕</button></div>
        {children}
      </div>
    </div>
  );
}

// Aviso corto (toast) con auto-cierre.
export function useToast() {
  const [t, setT] = useState(null);
  const timer = useRef(null);
  const show = useCallback((text, bad = false) => {
    setT({ text, bad });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 3500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = t ? <div className={`toast ${t.bad ? 'bad' : ''}`} role="status">{t.text}</div> : null;
  return [show, node];
}

// Anillo de cuota diaria: aro dorado grueso con centro azul.
export function Ring({ value, max, label, size = 98, stroke = 11 }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  const frac = max ? Math.min(1, value / max) : 1;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 + 1} fill="rgba(10,28,64,.55)" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FBBF24" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <div className="num"><div>{value}{max ? `/${max}` : ''}<small>{label}</small></div></div>
    </div>
  );
}

// Logo apilado (pantallas de marca): original en claro, variante clara en oscuro.
export function Logo({ height = 52, className = '' }) {
  return (
    <>
      <img src="/logo.png" alt="Aprueba" style={{ height }} className={`logo logo-l ${className}`} />
      <img src="/logo-dark.png" alt="" aria-hidden="true" style={{ height }} className={`logo logo-d ${className}`} />
    </>
  );
}

// Encabezado: marca "A" + nombre, como en el diseño.
export function BrandMark({ height = 46 }) {
  return (
    <span className="brandmark">
      <img src="/logo-mark.png" alt="" style={{ height }} className="logo-l" />
      <img src="/logo-mark-dark.png" alt="" style={{ height }} className="logo-d" />
      <span className="brandname">Aprueba</span>
    </span>
  );
}

// Pantalla de carga con el logo grande.
export function Splash({ text = 'Cargando…' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <Logo height={190} className="pulse" />
      <p>{text}</p>
    </div>
  );
}

// Iconos de la barra inferior (contorno / relleno cuando está activo).
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
const F = { fill: 'currentColor', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
const NAV = {
  home: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M3 11.2L12 3l9 8.2" /><path d="M5.5 10v10h13V10" /></svg>,
  bolt: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>,
  medal: (p) => <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="9" r="6" /><path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5" /></svg>,
  gift: (p) => <svg viewBox="0 0 24 24" {...p}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18" /><path d="M12 8c-3 0-4.5-4-1.5-4S12 8 12 8zm0 0c3 0 4.5-4 1.5-4S12 8 12 8z" /></svg>,
  menu: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
};
export function NavIcon({ name, active }) { return NAV[name](active && name !== 'menu' ? F : S); }

export const Icon = {
  home: NAV.home(S), bolt: NAV.bolt(S), medal: NAV.medal(S), gift: NAV.gift(S), menu: NAV.menu(S),
  help: <svg viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 3.5M12 17h.01" /></svg>,
  gear: <svg viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>,
  card: <svg viewBox="0 0 24 24" {...S}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>,
  out: <svg viewBox="0 0 24 24" {...S}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  arrow: <svg viewBox="0 0 24 24" width="18" height="18" {...S}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  flame: <svg viewBox="0 0 24 24" width="20" height="20"><defs><linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD166" /><stop offset="1" stopColor="#F97316" /></linearGradient></defs><path fill="url(#fl)" d="M12 2s5.5 4.8 5.5 10.2A5.5 5.5 0 0112 18a5.5 5.5 0 01-5.5-5.8C6.5 9.6 8 8.4 8 8.4s.6 3 2.7 3c0-3.4-.9-5.6 1.3-9.4z" /><path fill="#FFE4A8" d="M12 22a4.6 4.6 0 004.6-4.6c0-1.5-.9-2.7-.9-2.7s-.9 1.8-3.7 1.8-3.7-1.8-3.7-1.8-.9 1.2-.9 2.7A4.6 4.6 0 0012 22z" opacity=".85" /></svg>,
  star: <svg viewBox="0 0 24 24" width="26" height="26"><defs><linearGradient id="st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFD166" /><stop offset="1" stopColor="#F59E0B" /></linearGradient></defs><polygon fill="url(#st)" points="12,2 15,8.8 22.4,9.6 16.8,14.6 18.4,22 12,18.2 5.6,22 7.2,14.6 1.6,9.6 9,8.8" /></svg>,
  bars: <svg viewBox="0 0 24 24" width="26" height="26"><rect x="2.5" y="12" width="5" height="9" rx="1.6" fill="#2E7BFF" /><rect x="9.5" y="7" width="5" height="14" rx="1.6" fill="#1FA9F2" /><rect x="16.5" y="3" width="5" height="18" rx="1.6" fill="#2E7BFF" /></svg>,
  clipboard: <svg viewBox="0 0 96 110" width="92" height="106" aria-hidden="true"><defs><linearGradient id="cb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5C8FE8" /><stop offset="1" stopColor="#2B58B4" /></linearGradient></defs><rect x="8" y="12" width="72" height="92" rx="14" fill="url(#cb)" /><rect x="8" y="12" width="72" height="92" rx="14" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="2" /><rect x="28" y="4" width="32" height="16" rx="7" fill="#3A6BC9" stroke="#fff" strokeOpacity=".3" strokeWidth="2" /><g fill="#fff" opacity=".9"><rect x="22" y="36" width="10" height="10" rx="3" /><rect x="22" y="58" width="10" height="10" rx="3" /><rect x="22" y="80" width="10" height="10" rx="3" /></g><g stroke="#fff" strokeOpacity=".85" strokeWidth="5" strokeLinecap="round"><path d="M40 41h28M40 63h22M40 85h26" /></g><circle cx="76" cy="88" r="17" fill="#2B58B4" stroke="#fff" strokeOpacity=".5" strokeWidth="2.5" /><path d="M68 88l6 6 10-12" stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

// Íconos de materia (cuadrado redondeado con degradado, como en el diseño).
export function SubjectIcon({ id }) {
  const cfg = {
    m1: { a: '#4C93FF', b: '#2563EB', g: <g fill="#fff"><rect x="14" y="14" width="8" height="2.6" rx="1.3" /><rect x="17" y="11" width="2.6" height="8" rx="1.3" /><rect x="30" y="14" width="8" height="2.6" rx="1.3" /><rect x="14" y="32" width="8" height="2.6" rx="1.3" /><rect x="17" y="29" width="2.6" height="8" rx="1.3" /><rect x="30" y="32" width="8" height="2.6" rx="1.3" /><rect x="30" y="38" width="8" height="2.6" rx="1.3" /></g> },
    b1: { a: '#FFD166', b: '#F5A623', g: <g stroke="#7A4A00" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11h10M23 11v10L14 38a3 3 0 002.6 4.4h18.8A3 3 0 0038 38L29 21V11" /><path d="M18.5 32h15" /></g> },
    l1: { a: '#34D399', b: '#059669', g: <g stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M13 14c4-2 9-2 13 1 4-3 9-3 13-1v24c-4-2-9-2-13 1-4-3-9-3-13-1z" /><path d="M26 15v24" /></g> },
  }[id] || { a: '#8B9BB4', b: '#64748B', g: null };
  return (
    <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
      <defs><linearGradient id={`sj-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={cfg.a} /><stop offset="1" stopColor={cfg.b} /></linearGradient></defs>
      <rect width="52" height="52" rx="15" fill={`url(#sj-${id})`} />
      <rect width="52" height="52" rx="15" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
      {cfg.g}
    </svg>
  );
}
