import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { useAuth } from "./AuthContext";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "El correo no tiene un formato válido.",
  "auth/user-not-found": "No encontramos una cuenta con ese correo.",
  "auth/wrong-password": "Contraseña incorrecta. Intenta de nuevo.",
  "auth/invalid-credential": "Credenciales inválidas. Verifica tus datos.",
  "auth/user-disabled": "La cuenta está deshabilitada. Contacta al administrador.",
  "auth/too-many-requests": "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.",
};

const resolveAuthMessage = (error: unknown) => {
  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code?: string }).code || "").toLowerCase();
    if (code in AUTH_ERROR_MESSAGES) return AUTH_ERROR_MESSAGES[code];
    if (code.startsWith("auth/")) return "No pudimos iniciar sesión. Verifica tus datos.";
  }
  return "No pudimos iniciar sesión. Verifica tu correo y contraseña.";
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
    caption: "Portafolio visual - mantente al día con las imágenes de cada servicio",
  },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const nav = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      nav("/clientes", { replace: true });
    }
  }, [user, loading, nav]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth || !db) return;

    const emailTrimmed = email.trim();
    const passwordTrimmed = pass.trim();

    if (!emailTrimmed || !passwordTrimmed) {
      setErrorMsg("Completa ambos campos para continuar.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setResetMsg(null);

    try {
      // 🔐 1. Iniciar sesión con Firebase Auth
      const credential = await signInWithEmailAndPassword(auth, emailTrimmed, passwordTrimmed);
      const uid = credential.user.uid;

      // 🔎 2. Buscar documento en "barberos"
      const barberRef = doc(db, "barberos", uid);
      const barberSnap = await getDoc(barberRef);

      // 🔎 3. Si no está en barberos, buscar en "users"
      let role: string | null = null;
      if (barberSnap.exists()) {
        role = barberSnap.data().role || null;
      } else {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          role = userSnap.data().role || null;
        }
      }

      if (!role) {
        throw new Error("No se encontró el rol del usuario.");
      }

      // 🚀 4. Redirigir según rol
      if (role === "admin") {
        nav("/admin/usuarios", { replace: true });
      } else if (role === "barbero") {
        nav("/clientes", { replace: true });
      } else {
        throw new Error("Rol desconocido o no autorizado.");
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setErrorMsg(resolveAuthMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!auth) return;
    const emailTrimmed = email.trim();

    if (!emailTrimmed) {
      setErrorMsg("Ingresa tu correo para recuperar la contraseña.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, emailTrimmed);
      setResetMsg("Te enviamos un correo para restablecer tu contraseña.");
      setErrorMsg(null);
    } catch (error) {
      console.error("Error al enviar correo de recuperación:", error);
      setErrorMsg(resolveAuthMessage(error));
      setResetMsg(null);
    }
  };

  const logoSrc = `${import.meta.env.BASE_URL}images/logo.png`;

  return (
    <div className="login-hero">
      <div className="login-hero-inner">
        <div className="space-y-4 text-center">
          <div className="look-fusion-lockup">
            <img src={logoSrc} alt="Logotipo Look Fusion" className="look-fusion-logo" />
            <h1 className="login-heading look-fusion-wordmark">LOOK FUSION</h1>
          </div>
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
              <h2>Inicia sesión</h2>
              <p>Ingresa con tu correo corporativo. Te enviaremos automáticamente al módulo correspondiente según tu rol.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs uppercase tracking-wide text-black/50">Correo</label>
                <input
                  className="input mt-1"
                  placeholder="ejemplo@barberia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-black/50">Contraseña</label>
                <input
                  className="input mt-1"
                  placeholder="********"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="current-password"
                  required
                  minLength={6}
                />
              </div>

              {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
              {resetMsg && <p className="text-xs text-green-600">{resetMsg}</p>}

              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Ingresando..." : "Entrar"}
              </button>

              <button
                className="mt-2 text-sm font-semibold text-[#d67c21] underline hover:text-[#b86516]"
                type="button"
                disabled={submitting}
                onClick={handleResetPassword}
              >
                Olvidé mi contraseña
              </button>
            </form>

            <div className="text-xs text-black/50 space-y-1">
              <p><span className="font-semibold text-black/70">Rol admin:</span> administra barberos, roles y directorio.</p>
              <p><span className="font-semibold text-black/70">Rol barbero:</span> gestiona clientes, notas y galería asignada.</p>
              <p>Soporte: <span className="font-semibold text-black/70">barberiawebpro@gmail.com</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


