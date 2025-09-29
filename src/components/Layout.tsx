import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Props = { children: React.ReactNode };

export default function Layout({ children }: Props) {
  const { role, demoMode, logout, user } = useAuth();
  const navigate = useNavigate();

  const navClass = ({ isActive }: { isActive: boolean }) => `nav-pill${isActive ? " active" : ""}`;
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : null;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="inner">
          <Link to="/clientes" className="brand">
            Barberia Parsen
          </Link>
          <div className="nav-links">
            <NavLink to="/clientes" className={navClass}>
              Clientes
            </NavLink>
            {role === "admin" && (
              <NavLink to="/admin/usuarios" className={navClass}>
                Admin
              </NavLink>
            )}
            {roleLabel && <span className="nav-pill">{roleLabel}</span>}
            {demoMode && <span className="nav-pill">Demo</span>}
            {user && (
              <button type="button" className="nav-pill" onClick={handleLogout}>
                Salir
              </button>
            )}
          </div>
        </div>
      </nav>
      <main className="page-container">{children}</main>
    </div>
  );
}
