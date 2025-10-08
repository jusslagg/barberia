from pathlib import Path
from textwrap import dedent

content = dedent("""
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from \"firebase/auth\";
import { collection, doc, getDocs, limit, query, updateDoc, where } from \"firebase/firestore\";
import { FormEvent, useEffect, useState } from \"react\";
import { useNavigate } from \"react-router-dom\";
import { auth, db } from \"../lib/firebase\";
import { useAuth } from \"./AuthContext\";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  \"auth/invalid-email\": \"El correo no tiene un formato valido.\",
  \"auth/user-not-found\": \"No encontramos una cuenta con ese correo.\",
  \"auth/wrong-password\": \"Contrasena incorrecta. Intenta de nuevo.\",
  \"auth/invalid-credential\": \"Credenciales invalidas. Verifica tu correo y contrasena.\",
  \"auth/user-disabled\": \"La cuenta esta deshabilitada. Contacta al administrador.\",
  \"auth/too-many-requests\": \"Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.\",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveAuthMessage = (error: unknown) => {
  if (typeof error === \"object\" && error && \"code\" in error) {
    const code = String((error as { code?: string }).code || \"").toLowerCase();
    if (code in AUTH_ERROR_MESSAGES) return AUTH_ERROR_MESSAGES[code];
    if (code.startsWith(\"auth/\")) return \"No pudimos iniciar sesion. Verifica tus datos.\";
  }
  return \"No pudimos iniciar sesion. Verifica tu correo y contrasena.\";
};

const showcase = [
  {
    src: \"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80\",
    caption: \"Panel administrador - controla usuarios, permisos y reportes\",
  },
  {
    src: \"https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80\",
    caption: \"Experiencia del barbero - registra notas y estilos de tus clientes\",
  },
  {
    src: \"https://images.unsplash.com/photo-1505483531331-65230405b270?auto=format&fit=crop&w=900&q=80\",
    caption: \"Portafolio visual - mantente al dia con las imagenes de cada servicio\",
  },
];

type ReservedProfile = {
  refPath: string;
  collection: \"barberos\" | \"users\";
  data: Record<string, any>;
};

const extractDisplayName = (data?: Record<string, any> | null) => {
  if (!data) return undefined;
  const primary = data.displayName || data.nombre || data.Nombre;
  const last = data.lastName || data.apellido || data.Apellido;
  if (primary && last) return `${primary} ${last}`.trim();
  if (primary) return primary;
  if (last) return last;
  return undefined;
};

const findReservedProfile = async (email: string): Promise<ReservedProfile | null> => {
  if (!db) return null;
  const emailLower = email.toLowerCase();
  const checks: Array<{ col: \"barberos\" | \"users\"; field: string }> = [
    { col: \"barberos\", field: \"emailLower\" },
    { col: \"barberos\", field: \"email\" },
    { col: \"users\", field: \"emailLower\" },
    { col: \"users\", field: \"email\" },
  ];

  for (const { col, field } of checks) {
    const base = collection(db, col);
    const q = query(base, where(field, \"==\", field === \"emailLower\" ? emailLower : email), limit(1));
    const snap = await getDocs(q);
    const docSnap = snap.docs[0];
    if (docSnap) {
      return { refPath: `${col}/${docSnap.id}`, collection: col, data: docSnap.data() as Record<string, any> };
    }
  }
  return null;
};

const persistProfileLink = async (profile: ReservedProfile, uid: string, email: string, displayName?: string) => {
  if (!db) return;
  const ref = doc(db, profile.refPath);
  const payload: Record<string, any> = {
    uid,
    email,
    emailLower: email.toLowerCase(),
  };
  if (displayName) payload.displayName = displayName;
  await updateDoc(ref, payload);
};

export default function Login() {
  const [email, setEmail] = useState(\"\");
  const [pass, setPass] = useState(\"\");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const nav = useNavigate();
  const { user, role, loading } = useAuth();

  const resolvedHome = role === \"admin\" ? \"/admin/usuarios\" : \"/clientes\";

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    nav(resolvedHome, { replace: true });
  }, [user, role, loading, resolvedHome, nav]);

  const validateEmail = (value: string) => emailPattern.test(value.trim());

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return;

    const emailTrimmed = email.trim();
    const passwordTrimmed = pass.trim();

    if (!validateEmail(emailTrimmed)) {
      setErrorMsg(\"Ingresa un correo valido (ejemplo@dominio.com).\");
      return;
    }
    if (!passwordTrimmed) {
      setErrorMsg(\"Ingresa una contrasena.\");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await signInWithEmailAndPassword(auth, emailTrimmed, passwordTrimmed);
    } catch (error) {
      const code = typeof error === \"object\" && error && \"code\" in error ? String((error as { code?: string }).code || \"") : \"\";

      if (code === \"auth/user-not-found\") {
        try {
          if (!db) {
            setErrorMsg(\"No pudimos registrar tu cuenta en modo demo.\");
            return;
          }
          const reserved = await findReservedProfile(emailTrimmed);
          if (!reserved) {
            setErrorMsg(\"Tu correo no esta registrado por el administrador.\");
            return;
          }
          const credential = await createUserWithEmailAndPassword(auth, emailTrimmed, passwordTrimmed);
          const profileName = extractDisplayName(reserved.data);
          if (profileName) {
            await updateProfile(credential.user, { displayName: profileName }).catch(() => undefined);
          }
          await persistProfileLink(reserved, credential.user.uid, emailTrimmed, profileName);
          return;
        } catch (creationError) {
          console.error(\"No pudimos crear la cuenta en el primer acceso\", creationError);
          setErrorMsg(resolveAuthMessage(creationError));
          return;
        }
      }

      console.error(\"No pudimos iniciar sesion\", error);
      setErrorMsg(resolveAuthMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!auth) return;
    const emailTrimmed = email.trim();
    if (!validateEmail(emailTrimmed)) {
      setErrorMsg(\"Ingresa un correo valido para recuperar tu contrasena.\");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, emailTrimmed);
      setResetMsg(\"Te enviamos un correo para restablecer tu contrasena.\");
      setErrorMsg(null);
    } catch (error) {
      console.error(\"No pudimos enviar el correo de recuperacion\", error);
      setErrorMsg(resolveAuthMessage(error));
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
                  minLength={6}
                />
              </div>
              {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
              {resetMsg && <p className="text-xs text-green-600">{resetMsg}</p>}
              <button className="btn btn-primary" type="submit" disabled={submitting || loading}>
                {submitting ? "Ingresando..." : "Entrar"}
              </button>
              <button
                className="btn btn-ghost text-sm"
                type="button"
                disabled={submitting || loading}
                onClick={handleResetPassword}
              >
                Olvidé mi contrasena
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
""")

Path("src/auth/Login.tsx").write_text(content)
