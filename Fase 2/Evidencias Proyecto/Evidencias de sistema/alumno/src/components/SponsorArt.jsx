// Estilo visual por sponsor. Se elige por el nombre del sponsor: banco, café, librería/editorial, colegio.
// Cada uno tiene su color y una ilustración SVG propia (banco, taza de café, libros, birrete).

export function sponsorKind(name = '') {
  const n = name.toLowerCase();
  if (/banco|banc|cuenta|caja|finanz/.test(n)) return 'bank';
  if (/caf[eé]|cafeter|cafe|restaur|pasteler/.test(n)) return 'coffee';
  if (/libr|edit|texto|papel|imprenta|libro/.test(n)) return 'book';
  if (/preuni|colegio|liceo|academ|escuela|clases|tutor/.test(n)) return 'school';
  return 'gift';
}

const THEME = {
  bank: { a: '#1B4F8A', b: '#2E7BFF', label: 'Banco' },
  coffee: { a: '#7A3E1D', b: '#C7782F', label: 'Cafetería' },
  book: { a: '#0F6B5C', b: '#1FAE8E', label: 'Librería' },
  school: { a: '#4B2C8F', b: '#8B5CF6', label: 'Preuniversitario' },
  gift: { a: '#1E2A44', b: '#5B6B8C', label: 'Sponsor' },
};
export const sponsorTheme = (name) => THEME[sponsorKind(name)];

// Ilustraciones simples, pensadas para verse bien en pantalla chica.
function Art({ kind }) {
  if (kind === 'bank') return (
    <g fill="#fff">
      <polygon points="50,14 88,34 12,34" />
      <rect x="18" y="38" width="8" height="34" rx="2" /><rect x="34" y="38" width="8" height="34" rx="2" />
      <rect x="50" y="38" width="8" height="34" rx="2" /><rect x="66" y="38" width="8" height="34" rx="2" />
      <rect x="10" y="74" width="80" height="8" rx="3" />
      <circle cx="50" cy="26" r="4" fill="#FFD166" />
    </g>
  );
  if (kind === 'coffee') return (
    <g>
      <path d="M22 40h46v22a18 18 0 0 1-18 18h-10a18 18 0 0 1-18-18z" fill="#fff" />
      <path d="M68 46h6a9 9 0 0 1 0 18h-6" fill="none" stroke="#fff" strokeWidth="6" />
      <path d="M34 30c-4-5 4-8 0-14M46 30c-4-5 4-8 0-14M58 30c-4-5 4-8 0-14" fill="none" stroke="#FFD9A8" strokeWidth="3" strokeLinecap="round" />
      <rect x="14" y="84" width="72" height="5" rx="2.5" fill="#FFD9A8" />
    </g>
  );
  if (kind === 'book') return (
    <g>
      <rect x="18" y="20" width="16" height="60" rx="3" fill="#FFD166" />
      <rect x="36" y="16" width="16" height="64" rx="3" fill="#fff" />
      <rect x="54" y="24" width="16" height="56" rx="3" fill="#A7F3E0" />
      <path d="M74 80 L86 22 L94 24 L82 82 Z" fill="#fff" opacity=".9" />
    </g>
  );
  if (kind === 'school') return (
    <g fill="#fff">
      <polygon points="50,16 92,34 50,52 8,34" />
      <path d="M26 44v18c0 7 11 14 24 14s24-7 24-14V44l-24 10z" />
      <rect x="84" y="34" width="3" height="28" rx="1.5" />
      <circle cx="85.5" cy="66" r="4" fill="#FFD166" />
    </g>
  );
  return (
    <g fill="#fff">
      <rect x="20" y="38" width="60" height="44" rx="6" />
      <rect x="16" y="30" width="68" height="12" rx="4" />
      <rect x="46" y="30" width="8" height="52" fill="#FFD166" />
      <path d="M50 30c-10-14-22-6-14 0M50 30c10-14 22-6 14 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}

// Medallón con la ilustración del sponsor.
export function SponsorArt({ name, size = 56 }) {
  const t = sponsorTheme(name);
  const kind = sponsorKind(name);
  const id = `sa-${kind}-${size}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ flex: 'none' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={t.b} /><stop offset="1" stopColor={t.a} /></linearGradient>
      </defs>
      <rect width="100" height="100" rx="30" fill={`url(#${id})`} />
      <Art kind={kind} />
    </svg>
  );
}

// Cabecera grande del sponsor (en la tarjeta y en el comprobante).
export function SponsorHero({ name, children }) {
  const t = sponsorTheme(name);
  const kind = sponsorKind(name);
  const id = `sh-${kind}`;
  return (
    <div className="sponsor-hero" style={{ background: `linear-gradient(135deg, ${t.a} 0%, ${t.b} 100%)` }}>
      <svg className="sponsor-hero-art" viewBox="0 0 100 100" aria-hidden="true">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".25" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
        <circle cx="78" cy="22" r="46" fill={`url(#${id})`} />
        <Art kind={kind} />
      </svg>
      <div className="sponsor-hero-body">{children}</div>
    </div>
  );
}
