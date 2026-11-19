import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Icon, Medal, Ring, SubjectIcon, TIERS, TIER_NAME, useToast } from '../components/ui.jsx';

export default function Home() {
  const { user, refresh } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [toast, toastNode] = useToast();

  useEffect(() => {
    api.today().then((r) => {
      setD(r);
      if (r.loginReward.amount) { toast(`+${r.loginReward.amount} medalla de bronce por entrar hoy · racha de ${r.loginReward.streak} día${r.loginReward.streak === 1 ? '' : 's'}`); refresh(); }
    }).catch((e) => setErr(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <p className="error">{err}</p>;
  if (!d) return <p className="center">Cargando…</p>;
  const q = d.quota;
  const first = user.name.split(' ')[0];
  const planName = d.plan.name?.es || (typeof d.plan.name === 'string' ? d.plan.name : d.plan.id);

  return (
    <section>
      <div className="hero">
        <span className="hero-clip">{Icon.clipboard}</span>
        <div className="hero-top">
          <div>
            <h2>Hola, {first} <span aria-hidden="true">👋</span></h2>
            <div className="sub">¡Plan {planName}!</div>
          </div>
          <span className="streak">{Icon.flame} Racha: {d.streak} día{d.streak === 1 ? '' : 's'}</span>
        </div>
        <div className="hero-body">
          <Ring value={q.used} max={q.limit} label={q.limit === null ? 'hoy' : 'preguntas'} size={84} stroke={9} />
          <div className="grow">
            <b>Cuota diaria</b>
            <div className="sub" style={{ marginBottom: 10 }}>
              {q.limit === null ? 'Preguntas ilimitadas con tu plan' : `${q.used} de ${q.limit} usadas hoy`}
            </div>
            <Link to="/practicar" className="btn">Continuar practicando {Icon.arrow}</Link>
          </div>
        </div>
      </div>

      {q.limit !== null && q.limit < 20 && (
        <Link to="/ajustes" className="card tint-orange" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <b>Desbloquea más preguntas gratis</b>
          <div className="muted">Cuéntanos tu colegio y dirección y suma hasta {20 - q.limit} preguntas más al día.</div>
        </Link>
      )}

      <div className="card">
        <div className="card-h">{Icon.star}<span className="grow">Tus medallas</span><Link className="more" to="/medallas" style={{ fontSize: 16 }}>Ver todo {Icon.arrow}</Link></div>
        <div className="medals-row">
          {TIERS.map((t) => (
            <div className="m" key={t}><Medal tier={t} /><b>{d.medals[t]}</b><span>{TIER_NAME[t]}</span></div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-h">{Icon.bars}<span className="grow">Tu progreso</span></div>
        {d.tests.filter((t) => t.answered > 0 || user.prefs?.tests?.includes(t.id)).map((t) => {
          const pct = t.answered ? Math.round((t.correct / t.answered) * 100) : 0;
          return (
            <div key={t.id} className="subject tile">
              <SubjectIcon id={t.id} />
              <div className="grow">
                <div className="between"><span className="t">{t.es}</span><b style={{ fontSize: 20 }}>{t.answered ? `${pct}%` : '—'}</b></div>
                <div className="muted">{t.correct} correctas de {t.answered} respondidas</div>
                <div className="bar"><i style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
          );
        })}
      </div>
      {toastNode}
    </section>
  );
}
