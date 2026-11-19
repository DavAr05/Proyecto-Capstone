import { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import { applyTheme } from './theme.js';
import { BrandMark, Gem, NavIcon, Splash } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Home from './pages/Home.jsx';
import Practice from './pages/Practice.jsx';
import Medals from './pages/Medals.jsx';
import Benefits from './pages/Benefits.jsx';
import More from './pages/More.jsx';
import Support from './pages/Support.jsx';
import Settings from './pages/Settings.jsx';
import Plans from './pages/Plans.jsx';
import Pay from './pages/Pay.jsx';

const TABS = [
  ['/', 'home', 'Hoy', true],
  ['/practicar', 'bolt', 'Practicar'],
  ['/medallas', 'medal', 'Medallas'],
  ['/beneficios', 'gift', 'Beneficios'],
  ['/mas', 'menu', 'Más'],
];

function Shell({ children }) {
  const { user } = useAuth();
  return (
    <div className="app">
      <header className="top">
        <BrandMark />
        <span className="grow" />
        <span className="pill" title="Platino"><Gem size={38} />{user.medals.platinum}</span>
      </header>
      <main>{children}</main>
      <nav className="tabs" aria-label="Principal">
        {TABS.map(([to, icon, label, end]) => (
          <NavLink key={to} to={to} end={!!end}>
            {({ isActive }) => (<><NavIcon name={icon} active={isActive} />{label}</>)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  useEffect(() => { applyTheme(); }, []);

  if (loading) return <Splash />;
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>;

  // Primer uso: bienvenida (Siguiente) y selección de pruebas, a pantalla completa.
  if (!user.prefs?.tests?.length) return <Onboarding />;

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practicar" element={<Practice />} />
        <Route path="/medallas" element={<Medals />} />
        <Route path="/beneficios" element={<Benefits />} />
        <Route path="/mas" element={<More />} />
        <Route path="/soporte" element={<Support />} />
        <Route path="/ajustes" element={<Settings />} />
        <Route path="/pruebas" element={<Onboarding edit />} />
        <Route path="/planes" element={<Plans />} />
        <Route path="/pago" element={<Pay />} />
        <Route path="/pago/exito" element={<Pay returning />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
