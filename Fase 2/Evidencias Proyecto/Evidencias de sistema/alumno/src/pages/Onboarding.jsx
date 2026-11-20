import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { BrandMark, DIFF_NAME, Icon, Logo, Medal } from '../components/ui.jsx';

// Primer uso: 3 pantallas de bienvenida (Siguiente) y luego elegir pruebas.
// Con `edit` (Ajustes > Mis pruebas) muestra solo la selección.
const SLIDES = [
  { key: 'hi', title: (n) => `¡Hola, ${n}!`, sub: 'Bienvenido a Aprueba', text: 'Práctica diaria para la PAES. Pocos minutos al día.' },
  { key: 'practice', title: () => 'Practica a tu ritmo', sub: null, text: 'Preguntas de Matemática, Lenguaje y Biología, con explicación paso a paso.' },
  { key: 'medals', title: () => 'Gana medallas', sub: null, text: 'Cada acierto suma medallas. Cámbialas por beneficios exclusivos de nuestros sponsors.' },
];

export default function Onboarding({ edit = false }) {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(edit ? SLIDES.length : 0);
  const [info, setInfo] = useState(null);
  const [tests, setTests] = useState([]);
  const [diff, setDiff] = useState('d1');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.profile().then((p) => { setInfo(p); setTests(p.prefs.tests || []); setDiff(p.prefs.difficulty || 'd1'); }).catch((e) => setErr(e.message));
  }, []);

  function toggle(id) {
    setErr('');
    setTests((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (info.maxTests === 1) return [id];
      if (cur.length >= info.maxTests) { setErr(`Tu plan permite hasta ${info.maxTests} pruebas.`); return cur; }
      return [...cur, id];
    });
  }

  async function save() {
    setBusy(true); setErr('');
    try { await api.saveProfile({ tests, difficulty: diff }); await refresh(); nav(edit ? '/mas' : '/', { replace: true }); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const selection = !info ? <p className="center">{err || 'Cargando…'}</p> : (
    <>
      <h2 style={{ fontSize: 22 }}>{edit ? 'Mis pruebas' : '¿Qué pruebas quieres estudiar?'}</h2>
      <p className="muted" style={{ margin: '4px 0 14px' }}>
        Recibirás preguntas solo de las pruebas que elijas{info.maxTests === 1 ? ' (tu plan incluye 1)' : ''}. Puedes cambiarlas cuando quieras.
      </p>
      {info.tests.map((t) => (
        <button key={t.id} className={`choice ${tests.includes(t.id) ? 'on' : ''}`} onClick={() => toggle(t.id)}>
          <span className="dot">✓</span><b>{t.es}</b>
        </button>
      ))}
      <h3 style={{ margin: '18px 0 8px' }}>Nivel de dificultad</h3>
      <div className="seg" role="radiogroup" aria-label="Dificultad">
        {Object.entries(DIFF_NAME).map(([k, v]) => (
          <button key={k} className={diff === k ? 'on' : ''} role="radio" aria-checked={diff === k} onClick={() => setDiff(k)}>{v}</button>
        ))}
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="row" style={{ marginTop: 6 }}>
        {!edit && <button className="btn sec" onClick={() => setStep(SLIDES.length - 1)}>Atrás</button>}
        <button className="btn grow" disabled={!tests.length || busy} onClick={save}>{busy ? 'Guardando…' : edit ? 'Guardar' : 'Comenzar'}</button>
      </div>
    </>
  );

  if (edit) return <section>{selection}</section>;

  // Paso final: selección de pruebas (pantalla clara con el logo arriba)
  if (step >= SLIDES.length) {
    return (
      <div className="app">
        <header className="top center-logo"><BrandMark /></header>
        <main>
          <div className="dots" aria-hidden="true">{[...SLIDES, 0].map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
          {selection}
        </main>
      </div>
    );
  }

  const s = SLIDES[step];
  const first = user.name.split(' ')[0];
  return (
    <div className="intro">
      <div className="intro-body" key={s.key}>
        {step === 0 && <Logo height={210} />}
        {step === 1 && <div className="intro-ic">{Icon.bolt}</div>}
        {step === 2 && <div className="intro-medals"><Medal tier="bronze" size="lg" /><Medal tier="gold" size="lg" /><Medal tier="platinum" size="lg">◆</Medal></div>}
        <h1>{s.title(first)}</h1>
        {s.sub && <h2>{s.sub}</h2>}
        <p>{s.text}</p>
      </div>
      <div className="intro-foot">
        <div className="dots" aria-hidden="true">{[...SLIDES, 0].map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        <div className="row">
          {step > 0 && <button className="btn sec-on-dark" onClick={() => setStep(step - 1)}>Atrás</button>}
          <button className="btn grow" onClick={() => setStep(step + 1)}>Siguiente</button>
        </div>
      </div>
    </div>
  );
}
