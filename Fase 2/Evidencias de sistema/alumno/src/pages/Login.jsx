import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { Logo, Medal } from '../components/ui.jsx';

// Login de demostración: se elige un alumno de la base (sin contraseña).
export default function Login() {
  const { login } = useAuth();
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => { api.students().then(setStudents).catch((e) => setError(e.message)); }, []);

  async function enter(id) {
    setError(''); setBusy(id);
    try { await login(id); } catch (e) { setError(e.message); setBusy(null); }
  }

  return (
    <div className="login">
      <div className="brand">
        <Logo height={170} />
        <p>Práctica diaria para la PAES. Pocos minutos al día.</p>
      </div>
      <div className="sheet-card">
        <h2 style={{ fontSize: 18 }}>¿Quién eres?</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Demo: elige un alumno para entrar (sin contraseña).</p>
        {error && <p className="error" role="alert">{error}</p>}
        {!students && !error && <p className="center">Cargando alumnos…</p>}
        {(students || []).map((s) => (
          <button key={s.id} className="student" disabled={busy === s.id} onClick={() => enter(s.id)}>
            <span className="avatar">{s.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
            <span className="grow"><b>{s.name}</b><br /><span className="muted">{s.email}</span></span>
            <span className="row" style={{ gap: 4 }}><Medal tier="platinum" size="sm">◆</Medal><b>{s.platinum}</b></span>
          </button>
        ))}
      </div>
    </div>
  );
}
