import { signInWithEmailAndPassword } from "firebase/auth";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { useAuth } from "./AuthContext";


const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "El correo no tiene un formato valido.",
  "auth/user-not-found": "No encontramos una cuenta con ese correo.",
  "auth/wrong-password": "Contrasena incorrecta. Intenta de nuevo.",
  "auth/invalid-credential": "Credenciales invalidas. Verifica tu correo y contrasena.",
  "auth/user-disabled": "La cuenta esta deshabilitada. Contacta al administrador.",
  "auth/too-many-requests": "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.",
};

const resolveAuthMessage = (error: unknown) => {
  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code?: string }).code || "").toLowerCase();
    if (code in AUTH_ERROR_MESSAGES) return AUTH_ERROR_MESSAGES[code];
    if (code.startsWith("auth/")) return "No pudimos iniciar sesion. Verifica tus datos.";
  }
  return "No pudimos iniciar sesion. Verifica tu correo y contrasena.";
};

const showcase = [
  {
    src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
    caption: "Panel administrador - controla usuarios, permisos y reportes",
  },
  {
    src: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80",
    caption: "Experiencia del barbero - registra notas y estilos de tus clientes",
  },
  {
    src: "https://images.unsplash.com/photo-1505483531331-65230405b270?auto=format&fit=crop&w=900&q=80",
    caption: "Portafolio visual - mantente al dia con las imagenes de cada servicio",
  },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const nav = useNavigate();
  const { user, role, loading } = useAuth();

  const resolvedHome = role === "admin" ? "/admin/usuarios" : "/clientes";

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    nav(resolvedHome, { replace: true });
  }, [user, role, loading, resolvedHome, nav]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (error) {
      console.error("No pudimos iniciar sesion", error);
      setErrorMsg(resolveAuthMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-hero">
      <div className="login-hero-inner">
        <div className="space-y-4 text-center">
          <span className="login-eyebrow">Acceso interno</span>
          <h1 className="login-heading">Barberia Prueba</h1>
          <p className="text-base text-black/70 max-w-xl mx-auto">Gestiona operaciones, clientes y equipo en un panel profesional disenado para administradores y barberos.</p>
        </div>

        <div className="login-card">
          <div className="login-gallery">
            <div className="login-gallery-top">
              {showcase.slice(0, 2).map((item) => (
                <figure key={item.caption}>
                  <img src={item.src} alt={item.caption} />
                  <figcaption>{item.caption}</figcaption>
                </figure>
              ))}
            </div>
            <figure>
              <img src={showcase[2].src} alt={showcase[2].caption} />
              <figcaption>{showcase[2].caption}</figcaption>
            </figure>
          </div>

          <div className="login-panel">
            <div className="space-y-2">
              <h2>Inicia sesion</h2>
              <p>Ingresa con tu correo corporativo. Te enviaremos automaticamente al modulo correspondiente segun tu rol.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs uppercase tracking-wide text-black/50">Correo</label>
                <input
                  className="input mt-1"
                  placeholder="ejemplo@barberia.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-black/50">Contrasena</label>
                <input
                  className="input mt-1"
                  placeholder="********"
                  type="password"
                  value={pass}
                  onChange={(event) => setPass(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>
                {submitting ? "Ingresando..." : "Entrar"}
              </button>
            </form>

            <div className="text-xs text-black/50 space-y-1">
              <p><span className="font-semibold text-black/70">Rol admin:</span> administra barberos, roles y directorio.</p>
              <p><span className="font-semibold text-black/70">Rol barbero:</span> gestiona clientes, notas y galeria asignada.</p>
              <p>Soporte corporativo: <span className="font-semibold text-black/70">soporte@barberia.dev</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


