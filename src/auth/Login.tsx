import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AutoCarousel, { type CarouselItem } from "../components/AutoCarousel";
import { auth, db } from "../lib/firebase";
import { listDemoClients, listDemoPhotos } from "../lib/demoData";
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
  const [portfolioItems, setPortfolioItems] = useState<CarouselItem[]>([]);
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const isDemo = !db;
  const portfolioFeed = useMemo<CarouselItem[]>(() => {
    if (portfolioItems.length) return portfolioItems;
    const fallback = showcase[2];
    return [
      {
        id: "portfolio-fallback",
        url: fallback.src,
        alt: fallback.caption,
      },
    ];
  }, [portfolioItems]);

  useEffect(() => {
    if (!loading && user) {
      nav("/clientes", { replace: true });
    }
  }, [user, loading, nav]);

  useEffect(() => {
    let active = true;

    const extractPhotoUrl = (entry: unknown): string | null => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, any>;
        if (typeof record.url === "string" && record.url) return record.url;
        if (typeof record.secure_url === "string" && record.secure_url) return record.secure_url;
        if (typeof record.path === "string" && record.path) return record.path;
      }
      return null;
    };

    const loadDemoPhotos = () => {
      const clients = listDemoClients();
      const normalized: CarouselItem[] = [];
      clients.forEach((client) => {
        const photos = listDemoPhotos(client.id);
        photos.forEach((photo, index) => {
          if (!photo?.url) return;
          normalized.push({
            id: `${client.id}-${photo.id ?? index}`,
            url: photo.url,
          });
        });
      });
      return normalized;
    };

    const fetchPortfolioFromCuts = async (): Promise<CarouselItem[]> => {
      if (!db) return [];
      const cutsRef = collection(db, "cuts");
      const snapshot = await getDocs(cutsRef);
      const aggregated: { id: string; url: string; createdAt: number }[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const createdAt = data.createdAt?.toMillis
          ? data.createdAt.toMillis()
          : typeof data.createdAt === "number"
            ? data.createdAt
            : 0;
        const photos = Array.isArray(data.photos) ? data.photos : [];
        photos.forEach((entry, index) => {
          const url = extractPhotoUrl(entry);
          if (!url) return;
          aggregated.push({
            id: `${docSnap.id}-${index}`,
            url,
            createdAt,
          });
        });
      });

      aggregated.sort((a, b) => b.createdAt - a.createdAt);
      return aggregated.map(({ id, url }) => ({ id, url }));
    };

    const fetchPublicPortfolio = async (): Promise<CarouselItem[]> => {
      if (!db) return [];
      const baseRef = collection(db, "public_portfolio");
      const q = query(baseRef, orderBy("createdAt", "desc"), limit(30));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          const url = typeof data.url === "string" ? data.url : null;
          if (!url) return null;
          return { id: docSnap.id, url };
        })
        .filter(Boolean) as CarouselItem[];
    };

    const loadPhotos = async () => {
      if (isDemo || !db) {
        const demoPhotos = loadDemoPhotos();
        if (active) setPortfolioItems(demoPhotos);
        return;
      }

      try {
        const publicItems = await fetchPublicPortfolio();
        if (publicItems.length) {
          if (active) setPortfolioItems(publicItems);
          return;
        }
      } catch (error) {
        console.error("No pudimos acceder al portafolio publico.", error);
      }

      try {
        const fallbackItems = await fetchPortfolioFromCuts();
        if (active) setPortfolioItems(fallbackItems);
      } catch (error) {
        console.error("No pudimos cargar las imagenes del portafolio visual.", error);
        if (active) setPortfolioItems([]);
      }
    };

    loadPhotos().catch((error) => console.error("Error inesperado al cargar portafolio visual.", error));

    return () => {
      active = false;
    };
  }, [isDemo]);

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
              <AutoCarousel items={portfolioFeed} transitionMs={1300} />
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


