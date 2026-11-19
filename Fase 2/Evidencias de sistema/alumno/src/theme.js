// Tema claro/oscuro: 'light' | 'dark' | null (sigue al sistema). Se guarda por dispositivo.
const KEY = 'aprueba_alumno_theme';
export const getTheme = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export function applyTheme(t = getTheme()) {
  const dark = t === 'dark' || (!t && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', !!dark);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? '#0B1220' : '#1A365D');
}
export function setTheme(t) {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* sin storage */ }
  applyTheme(t);
}
