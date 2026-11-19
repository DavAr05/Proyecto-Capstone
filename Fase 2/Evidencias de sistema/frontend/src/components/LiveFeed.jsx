import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

// Actividad en vivo: consulta /live cada 1,5 s y, cuando un alumno canjea, abre un ticket o se suscribe,
// muestra el aviso, actualiza la cifra y enciende la pastilla EN LA MISMA PINTADA. Después la vista
// recarga desde el servidor y la cifra queda con el valor real.
const POLL_MS = 1500;
const TOAST_MS = 7000;
const EVENT = 'aprueba:live';

// Una vista se recarga sola al llegar actividad. Antes de pedir los datos, se vuelve a pintar
// con la cifra ajustada, así el número cambia al mismo tiempo que aparece el aviso.
export function useLiveRefresh(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  const [, tick] = useState(0);
  useEffect(() => {
    const h = () => { tick((n) => n + 1); try { ref.current?.(); } catch { /* la vista maneja sus errores */ } };
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
}

// ── Estado de cada cifra (por pestaña, en sessionStorage) ──
// pend: lo que se sumó en vivo y el servidor aún no refleja. last: último valor del servidor visto.
// bump: contador de la pastilla verde (se limpia con un clic).
const num = (k) => { try { const v = sessionStorage.getItem(k); return v === null ? 0 : Number(v) || 0; } catch { return 0; } };
const put = (k, v) => { try { sessionStorage.setItem(k, String(v)); } catch { /* sin storage */ } };
const del = (k) => { try { sessionStorage.removeItem(k); } catch { /* sin storage */ } };

// Valor a mostrar: el del servidor, o el ajustado mientras el servidor no lo alcanza.
export function adj(id, server) {
  if (typeof server !== 'number' || Number.isNaN(server)) return server;
  const pend = num(`aprueba_pend:${id}`);
  const last = num(`aprueba_last:${id}`);
  if (pend > 0) {
    const target = last + pend;
    if (server >= target) { del(`aprueba_pend:${id}`); put(`aprueba_last:${id}`, server); return server; }
    return Math.max(server, target);
  }
  put(`aprueba_last:${id}`, server);
  return server;
}

const BUMP_KEY = (id) => `aprueba_bump:${id}`;
export const getBump = (id) => num(BUMP_KEY(id));
export function clearBump(id) { del(BUMP_KEY(id)); }
function addTo(id, n) {
  put(`aprueba_pend:${id}`, num(`aprueba_pend:${id}`) + n);
  put(BUMP_KEY(id), num(BUMP_KEY(id)) + n);
}
function bumpForSubscription(e) {
  const monthlyUsd = Math.round((e.interval === 'yearly' ? e.amount / 12 : e.amount) / 100);
  addTo('mrr', monthlyUsd);
  addTo('converted', 1);
  addTo('active-subs', 1);
}

// Pastilla verde "+N" junto a una cifra (con tope: +9+ / +$99+). Clic = limpiar.
export function LiveDelta({ id, money = false, cap }) {
  const [, force] = useState(0);
  const b = getBump(id);
  if (b <= 0) return null;
  const max = cap ?? (money ? 99 : 9);
  const shown = Math.min(b, max);
  const txt = `+${money ? '$' : ''}${shown}${b > max ? '+' : ''}`;
  return (
    <button type="button" className="live-delta" key={`${id}-${b}`}
      title="Nuevo desde que llegó el aviso · clic para limpiar"
      aria-label={`${txt} nuevos`}
      onClick={(e) => { e.stopPropagation(); clearBump(id); force((n) => n + 1); }}>{txt}</button>
  );
}

export default function LiveFeed({ lang, onActivity }) {
  const [toasts, setToasts] = useState([]);
  const sinceRef = useRef(null);
  const seen = useRef(new Set());
  const cb = useRef(onActivity);
  cb.current = onActivity;

  useEffect(() => {
    let alive = true;
    let timer = null;

    const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));

    async function tick() {
      if (!alive) return;
      if (!document.hidden) {
        try {
          const path = sinceRef.current ? `/live?since=${encodeURIComponent(sinceRef.current)}` : '/live';
          const res = await api.get(path);
          const { now, events } = res.data;
          if (!sinceRef.current) {
            sinceRef.current = now;
          } else {
            const fresh = events.filter((e) => !seen.current.has(e.id));
            fresh.forEach((e) => seen.current.add(e.id));
            const last = events.length ? events[events.length - 1].createdAt : null;
            const back = new Date(new Date(now).getTime() - 10000).toISOString();
            sinceRef.current = last && last > back ? last : back;
            if (fresh.length && alive) {
              // Todo en el mismo bloque síncrono: pastilla, aviso y recarga de la vista se pintan juntos.
              fresh.filter((e) => e.type === 'subscription').forEach(bumpForSubscription);
              setToasts((t) => [...t, ...fresh].slice(-4));
              fresh.forEach((e) => setTimeout(() => dismiss(e.id), TOAST_MS));
              window.dispatchEvent(new CustomEvent(EVENT, { detail: fresh }));
              cb.current?.(fresh);
            }
          }
        } catch { /* sin red o sesión vencida: se reintenta */ }
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    }
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  if (!toasts.length) return null;
  const en = lang === 'en';
  return (
    <div className="live-toasts" role="status" aria-live="polite">
      {toasts.map((e) => (
        <div key={e.id} className={`live-toast ${e.type}`}>
          {e.type === 'redeem' ? (
            <>
              <strong>{e.userName} {en ? 'redeemed' : 'canjeó'} «{e.benefitName}»</strong>
              <span>{e.sponsorName ? `${e.sponsorName} · ` : ''}💎 {e.platinumSpent}</span>
            </>
          ) : e.type === 'subscription' ? (
            <>
              <strong>🎉 {e.userName} {en ? 'subscribed to' : 'se suscribió a'} «{e.planName}»</strong>
              <span>${(e.amount / 100).toFixed(2)} USD · {e.interval === 'yearly' ? (en ? 'yearly' : 'anual') : (en ? 'monthly' : 'mensual')}</span>
            </>
          ) : e.type === 'correction' ? (
            <>
              <strong>{e.userName} {en ? 'requested a question review' : 'solicitó una recorrección'}</strong>
              <span>{en ? 'Question' : 'Pregunta'} {e.questionId}</span>
            </>
          ) : (
            <>
              <strong>{e.userName} {en ? 'opened ticket' : 'abrió el ticket'} #{e.number}</strong>
              <span>{e.subject}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
