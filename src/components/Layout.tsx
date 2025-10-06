
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Props = { children: React.ReactNode };

export default function Layout({ children }: Props) {
  const { role, logout, user, profileName } = useAuth();
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : null;
  const userName = profileName || user?.displayName || user?.email || roleLabel || "Perfil";
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const navClass = ({ isActive }: { isActive: boolean }) => `nav-pill${isActive ? " active" : ""}`;
  const homePath = role === "admin" ? "/admin/usuarios" : "/clientes";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    setMenuOpen(false);
  };

  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => setMenuOpen((prev) => !prev);

  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="inner">
          <div className="navbar-heading">
            <Link to={homePath} className="brand" onClick={closeMenu}>
              Barberia Prueba
            </Link>
            <button
              type="button"
              className="navbar-toggle"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-controls="primary-nav"
            >
              <span className="sr-only">Abrir menu</span>
              <span className="line" />
              <span className="line" />
              <span className="line" />
            </button>
          </div>

          <div id="primary-nav" className={`nav-links${menuOpen ? " open" : ""}`}>
            <NavLink to="/clientes" className={navClass} onClick={closeMenu}>
              Clientes
            </NavLink>
            {role === "admin" && (
              <NavLink to="/admin/usuarios" className={navClass} onClick={closeMenu}>
                Dashboard
              </NavLink>
            )}
            {user && (
              <span className="nav-pill">{userName}</span>
            )}
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
