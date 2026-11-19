import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Icon } from '../components/ui.jsx';

export default function More() {
  const { user, logout } = useAuth();
  return (
    <section>
      <div className="card row">
        <span className="avatar" style={{ width: 50, height: 50 }}>{user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
        <div><b style={{ fontSize: 16 }}>{user.name}</b><div className="muted">{user.email}</div></div>
      </div>
      <div className="menu">
        <Link to="/soporte"><span className="ic">{Icon.help}</span><span className="grow">Soporte<small>Crea un ticket y revisa su estado</small></span></Link>
        <Link to="/planes"><span className="ic">{Icon.card}</span><span className="grow">Planes<small>Compara y elige tu plan</small></span></Link>
        <Link to="/ajustes"><span className="ic">{Icon.gear}</span><span className="grow">Ajustes<small>Apariencia, pruebas y cuota diaria</small></span></Link>
        <button className="mi" onClick={logout}><span className="ic">{Icon.out}</span><span className="grow">Cerrar sesión</span></button>
      </div>
    </section>
  );
}
