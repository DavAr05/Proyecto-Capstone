import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { getTheme, setTheme } from '../theme.js';
import { DIFF_NAME, TEST_NAME, useToast } from '../components/ui.jsx';

export default function Settings() {
  const { refresh } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [school, setSchool] = useState('');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');
  const [theme, setT] = useState(getTheme());
  const [busy, setBusy] = useState(false);
  const [toast, toastNode] = useToast();

  useEffect(() => {
    api.profile().then((p) => { setPrefs(p.prefs); setSchool(p.prefs.school || ''); setAge(p.prefs.age || ''); setAddress(p.prefs.address || ''); }).catch((e) => toast(e.message, true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseTheme = (t) => { setT(t); setTheme(t); };

  async function save() {
    setBusy(true);
    try {
      const r = await api.saveProfile({ school, address, age: age === '' ? null : Number(age) });
      setPrefs(r.prefs); await refresh();
      toast(r.quota.limit === null ? 'Datos guardados' : `Datos guardados · tu cuota diaria es de ${r.quota.limit} preguntas`);
    } catch (e) { toast(e.message, true); } finally { setBusy(false); }
  }

  async function toggleNotif() {
    const v = !prefs.notif;
    setPrefs({ ...prefs, notif: v });
    try { await api.saveProfile({ notif: v }); } catch (e) { toast(e.message, true); setPrefs({ ...prefs, notif: !v }); }
  }

  if (!prefs) return <p className="center">Cargando…</p>;
  return (
    <section>
      <div className="page-h"><h2>Ajustes</h2></div>

      <div className="card">
        <h3>Apariencia</h3>
        <div className="seg" style={{ marginTop: 8, marginBottom: 0 }}>
          {[[null, 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, v]) => (
            <button key={v} className={theme === k ? 'on' : ''} onClick={() => chooseTheme(k)}>{v}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="between"><h3>Mis pruebas</h3><Link className="btn ghost sm" to="/pruebas">Cambiar</Link></div>
        <p className="muted">{(prefs.tests || []).map((t) => TEST_NAME[t] || t).join(' · ') || 'Sin elegir'} · Nivel {DIFF_NAME[prefs.difficulty] || '—'}</p>
      </div>

      <div className="card tint-orange">
        <h3>Desbloquea más preguntas gratis</h3>
        <p className="muted">Base 10 al día · +5 con tu colegio · +5 con tu dirección (máx. 20).</p>
        <label className="f">Colegio / Liceo<input value={school} onChange={(e) => setSchool(e.target.value)} maxLength={120} /></label>
        <label className="f">Edad<input type="number" inputMode="numeric" min="5" max="99" value={age} onChange={(e) => setAge(e.target.value)} /></label>
        <label className="f">Dirección (comuna y calle) · opcional<input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={120} /></label>
        <button className="btn block" style={{ marginTop: 14 }} disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>

      <div className="card between">
        <div><h3>Recordatorio diario</h3><span className="muted">Aviso para practicar cada día (demo)</span></div>
        <button className={`btn sm ${prefs.notif ? '' : 'sec'}`} onClick={toggleNotif}>{prefs.notif ? 'Activado' : 'Activar'}</button>
      </div>
      {toastNode}
    </section>
  );
}
