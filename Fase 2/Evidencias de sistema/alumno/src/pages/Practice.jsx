import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { DIFF_NAME, Medal, Sheet, TEST_NAME, useToast } from '../components/ui.jsx';

const REASONS = [
  ['wrong_answer', 'La respuesta marcada como correcta es incorrecta'],
  ['ambiguous', 'El enunciado es ambiguo o confuso'],
  ['typo', 'Hay un error tipográfico o de redacción'],
  ['bad_explanation', 'La explicación es incorrecta o incompleta'],
  ['other', 'Otro motivo'],
];
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function Practice() {
  const { setUser } = useAuth();
  const [q, setQ] = useState(null);
  const [quota, setQuota] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | quota | empty | error
  const [sel, setSel] = useState(null);
  const [res, setRes] = useState(null);
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sheet, setSheet] = useState(null); // 'skill' | 'correction'
  const [rc, setRc] = useState({ reason: 'wrong_answer', comment: '', proposed: '' });
  const [toast, toastNode] = useToast();
  const t0 = useRef(0);

  const load = useCallback(async () => {
    setState('loading'); setSel(null); setRes(null); setSecs(0); setErr(''); setSheet(null);
    try {
      const r = await api.nextQuestion();
      setQ(r.question); setQuota(r.quota); t0.current = Date.now(); setState('ready');
    } catch (e) {
      if (e.code === 'QUOTA_EXCEEDED') { setQuota(e.details); setState('quota'); }
      else { setErr(e.message); setState(e.code === 'NO_QUESTIONS' ? 'empty' : 'error'); }
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (state !== 'ready' || res) return undefined;
    const id = setInterval(() => setSecs(Math.floor((Date.now() - t0.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [state, res]);

  async function check() {
    setBusy(true); setErr('');
    try {
      const ms = Date.now() - t0.current;
      const r = await api.answer(q.id, sel, ms);
      setRes(r); setQuota(r.quota); setSecs(Math.floor(ms / 1000));
      setUser((u) => ({ ...u, medals: r.medals }));
    } catch (e) {
      if (e.code === 'QUOTA_EXCEEDED') { setQuota(e.details); setState('quota'); } else setErr(e.message);
    } finally { setBusy(false); }
  }

  async function sendCorrection() {
    setBusy(true);
    try {
      await api.correction(q.id, { reason: rc.reason, comment: rc.comment, proposedAnswer: rc.reason === 'wrong_answer' ? rc.proposed : null });
      setSheet(null); toast('Solicitud enviada. Nuestro equipo la revisará.');
    } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }

  if (state === 'loading') return <p className="center">Buscando una pregunta…</p>;
  if (state === 'error' || state === 'empty') return <div className="card center"><p>{err}</p><button className="btn" style={{ marginTop: 12 }} onClick={load}>Reintentar</button></div>;

  if (state === 'quota') {
    return (
      <section>
        <div className="card tint-orange center">
          <h2 style={{ fontSize: 20 }}>Llegaste al límite diario</h2>
          <p style={{ margin: '8px 0 14px' }}>Usaste tus {quota?.limit} preguntas de hoy. Vuelve mañana o desbloquea más.</p>
          {quota?.canUnlock && <Link to="/ajustes" className="btn block" style={{ marginBottom: 10 }}>Desbloquear más preguntas gratis</Link>}
          <Link to="/planes" className="btn brand block">Ver planes</Link>
        </div>
      </section>
    );
  }

  const letters = 'ABCDE';
  return (
    <section>
      <div className="q-meta">
        <span className="chip">{TEST_NAME[q.testId] || q.testId}</span>
        <span className="chip">{DIFF_NAME[q.difficulty] || q.difficulty}</span>
        <span className="timer" aria-label="Tiempo">⏱ {fmtTime(secs)}</span>
      </div>
      {quota && <p className="muted" style={{ marginBottom: 8 }}>{quota.limit === null ? `Pregunta ${quota.used + (res ? 0 : 1)} de hoy` : `Pregunta ${Math.min(quota.limit, quota.used + (res ? 0 : 1))} de ${quota.limit}`}</p>}
      <div className="card">
        <p className="q-text">{q.statement}</p>
        <div className="opts" role="radiogroup" aria-label="Alternativas">
          {q.options.map((o, i) => {
            const L = letters[i];
            let cls = 'opt';
            if (res) { if (L === res.correctAnswer) cls += ' ok'; else if (L === res.chosen) cls += ' no'; } else if (L === sel) cls += ' sel';
            return (
              <button key={L} className={cls} disabled={!!res} role="radio" aria-checked={sel === L} onClick={() => setSel(L)}>
                <span className="l">{L}</span><span className="grow">{o}</span>
              </button>
            );
          })}
        </div>
        {err && <p className="error" role="alert">{err}</p>}
        {!res && <button className="btn block" style={{ marginTop: 14 }} disabled={!sel || busy} onClick={check}>{busy ? 'Comprobando…' : 'Comprobar respuesta'}</button>}
      </div>

      {res && (
        <div className={`result ${res.correct ? 'ok' : 'no'}`}>
          <h3>{res.correct ? '¡Correcto! 🎉' : 'Incorrecto'}</h3>
          <p className="muted">Respondiste en {fmtTime(secs)}{!res.correct && ` · la correcta era la ${res.correctAnswer}`}</p>
          {res.reward && <div className="reward"><Medal tier="bronze" size="sm" /> +{res.reward.amount} medalla de bronce</div>}
          {res.explanation && <p className="expl">{res.explanation}</p>}
          <div className="divider" />
          <div className="between" style={{ flexWrap: 'wrap' }}>
            <button className="btn ghost sm" onClick={() => setSheet('skill')}>¿Qué necesito saber?</button>
            <button className="btn ghost sm" onClick={() => setSheet('correction')}>Solicitar recorrección</button>
          </div>
          <button className="btn block" style={{ marginTop: 10 }} onClick={load}>Siguiente pregunta</button>
        </div>
      )}

      {sheet === 'skill' && (
        <Sheet title="Habilidad evaluada" onClose={() => setSheet(null)}>
          <p className="muted" style={{ marginBottom: 8 }}>Competencia específica que mide esta pregunta</p>
          <p>{res?.requiredSkill || 'Esta pregunta aún no tiene una habilidad asociada.'}</p>
          <button className="btn block" style={{ marginTop: 14 }} onClick={() => setSheet(null)}>Volver a la explicación</button>
        </Sheet>
      )}

      {sheet === 'correction' && (
        <Sheet title="Solicitar revisión" onClose={() => setSheet(null)}>
          <p className="muted" style={{ marginBottom: 10 }}>Si crees que la pregunta o la respuesta oficial tiene un error, cuéntanos. Si se confirma, ganas medallas de bronce.</p>
          {REASONS.map(([k, v]) => (
            <button key={k} className={`choice ${rc.reason === k ? 'on' : ''}`} onClick={() => setRc({ ...rc, reason: k })}><span className="dot">✓</span><span>{v}</span></button>
          ))}
          {rc.reason === 'wrong_answer' && (
            <label className="f">¿Cuál crees que es la correcta?
              <select value={rc.proposed} onChange={(e) => setRc({ ...rc, proposed: e.target.value })}>
                <option value="">No estoy seguro/a</option>
                {q.options.map((_, i) => <option key={i} value={letters[i]}>{letters[i]}</option>)}
              </select>
            </label>
          )}
          <label className="f">Explica con tus palabras (opcional)
            <textarea rows={3} maxLength={500} value={rc.comment} onChange={(e) => setRc({ ...rc, comment: e.target.value })} />
          </label>
          <button className="btn block" style={{ marginTop: 14 }} disabled={busy} onClick={sendCorrection}>{busy ? 'Enviando…' : 'Enviar solicitud de revisión'}</button>
        </Sheet>
      )}
      {toastNode}
    </section>
  );
}
