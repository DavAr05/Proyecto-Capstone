import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../components/ui.jsx';

const CATS = { login: 'Acceso / login', payments: 'Pagos', other: 'Otro' };
const STATUS = { open: 'Abierto', progress: 'En curso', closed: 'Cerrado' };

export default function Support() {
  const [rows, setRows] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('other');
  const [busy, setBusy] = useState(false);
  const [toast, toastNode] = useToast();

  const load = () => api.tickets().then(setRows).catch((e) => toast(e.message, true));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await api.createTicket({ subject, body, category });
      setSubject(''); setBody('');
      toast(`Ticket #${t.number} creado. Ya lo ve el equipo de soporte.`);
      await load();
    } catch (err) { toast(err.message, true); } finally { setBusy(false); }
  }

  return (
    <section>
      <div className="page-h"><h2>Soporte</h2></div>
      <form className="card" onSubmit={submit}>
        <h3>Nuevo ticket</h3>
        <label className="f">Asunto<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required /></label>
        <label className="f">Categoría
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="f">Mensaje<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} required /></label>
        <button className="btn block" style={{ marginTop: 14 }} disabled={busy}>{busy ? 'Enviando…' : 'Crear ticket'}</button>
      </form>
      <h3 style={{ margin: '16px 0 8px' }}>Mis tickets</h3>
      {rows && rows.length === 0 && <p className="muted">No tienes tickets.</p>}
      {(rows || []).map((t) => (
        <div key={t.id} className="card">
          <div className="between"><span className="muted">#{t.number} · {CATS[t.category] || t.category}</span><span className="chip">{STATUS[t.status] || t.status}</span></div>
          <h3 style={{ marginTop: 4 }}>{t.subject}</h3>
        </div>
      ))}
      {toastNode}
    </section>
  );
}
