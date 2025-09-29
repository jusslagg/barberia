import { signInWithEmailAndPassword } from "firebase/auth";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import { listDemoUsers } from "../lib/demoData";

const gallery = [
  {
    src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
    label: "Fade clasico",
  },
  {
    src: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80",
    label: "Barba pulida",
  },
  {
    src: "https://images.unsplash.com/photo-1505483531331-65230405b270?auto=format&fit=crop&w=900&q=80",
    label: "Detalle lateral",
  },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const nav = useNavigate();
  const { demoMode, loginDemo, logout, user, role } = useAuth();

  const isDemo = demoMode;

  useEffect(() => {
    if (user) nav("/clientes");
  }, [user, nav]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      nav("/clientes");
    } catch (error) {
      console.error("No pudimos iniciar sesion", error);
      setErrorMsg("No pudimos iniciar sesion. Verifica tu correo y contrasena.");
    } finally {
      setSubmitting(false);
    }
  };

  const demoAccounts = useMemo(() => (isDemo ? listDemoUsers() : []), [isDemo, user]);

  const handleDemoLogin = (id: string) => {
    loginDemo(id);
    nav("/clientes");
  };

  const handleDemoLogout = async () => {
    await logout();
  };

  return (
    <div className="login-hero">
      <div className="login-hero-inner">
        <div className="space-y-4 text-center">
          <span className="login-eyebrow">Dashboard interno</span>
          <h1 className="login-heading">Barberia Parsen</h1>
          <span className="login-badge">Acceso de barberos</span>
        </div>

        <div className="login-card">
          <div className="login-gallery">
            <div className="login-gallery-top">
              {gallery.slice(0, 2).map((item) => (
                <figure key={item.label}>
                  <img src={item.src} alt={item.label} />
                  <figcaption>{item.label}</figcaption>
                </figure>
              ))}
            </div>
            <figure>
              <img src={gallery[2].src} alt={gallery[2].label} />
              <figcaption>{gallery[2].label}</figcaption>
            </figure>
          </div>

          <div className="login-panel">
            <div className="space-y-2">
              <h2>{isDemo ? "Explora la demo" : "Inicia sesion"}</h2>
              <p>
                {isDemo
                  ? "Firebase aun no esta conectado. Usa el recorrido de demostracion para ver la experiencia completa."
                  : "Ingresa tus credenciales para administrar clientes, fotos y notas de la barberia."}
              </p>
            </div>

            {isDemo ? (
              <div className="login-form">
                {user ? (
                  <div className="space-y-3 text-left">
                    <p className="text-sm text-black/70">
                      Estas autenticado como <strong>{user.displayName || user.email}</strong> ({role}).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-primary" type="button" onClick={() => nav("/clientes")}>Ir al panel</button>
                      <button className="btn btn-ghost" type="button" onClick={handleDemoLogout}>Cerrar sesion</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-left">
                    <p className="text-sm text-black/70">
                      Elige un perfil de demostracion para ingresar.
                    </p>
                    {demoAccounts.length ? (
                      <div className="grid gap-2">
                        {demoAccounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            className="btn btn-primary justify-between"
                            onClick={() => handleDemoLogin(account.id)}
                          >
                            <span className="font-semibold">{account.displayName}</span>
                            <span className="text-sm text-[rgba(44,21,10,0.7)]">{account.email}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-black/60">No hay cuentas de demostracion disponibles.</p>
                    )}
                    <p className="text-xs text-black/60">
                      Las cuentas de ejemplo tienen roles preconfigurados para que veas la diferencia entre admin y barbero.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <form className="login-form" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-black/50">Correo</label>
                  <input
                    className="input mt-1"
                    placeholder="ejemplo@barberia.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
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
                  />
                </div>
                {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? "Ingresando..." : "Entrar"}
                </button>
              </form>
            )}

            <div className="text-xs text-black/50 space-y-1">
              <p>Tip: recuerda actualizar roles desde la seccion Admin &gt; Usuarios.</p>
              <p>Soporte en <span className="font-semibold text-black/70">soporte@barberia.dev</span>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
