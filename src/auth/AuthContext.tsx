import { signOut, onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import type { Role } from "../types";
import { auth, db } from "../lib/firebase";
import { listDemoUsers, type DemoUser } from "../lib/demoData";

const FALLBACK_ADMIN_EMAIL = "barberiawebpro@gmail.com";
const USERS_COLLECTION = "users";
const BARBERS_COLLECTION = "barberos";

interface AuthContextValue {
  user: User | null;
  role?: Role;
  profileName?: string;
  loading: boolean;
  demoMode: boolean;
  loginDemo: (userId: string) => void;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue>({
  user: null,
  role: undefined,
  profileName: undefined,
  loading: true,
  demoMode: false,
  loginDemo: () => undefined,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthCtx);

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() || null;

const normalizeRoleValue = (value: unknown): Role | undefined => {
  if (!value) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (["admin", "administrador", "administrator"].includes(normalized)) return "admin";
  if (normalized.includes("barber")) return "barbero";
  return undefined;
};

const extractName = (data: Record<string, any> | undefined | null): string | undefined => {
  if (!data) return undefined;
  const primary = data.displayName || data.nombre || data.Nombre;
  const last = data.lastName || data.apellido || data.Apellido;
  if (primary && last) return `${primary} ${last}`.trim();
  return primary || last || undefined;
};

const resolveProfileFromDb = async (uid: string, email?: string | null): Promise<{ role?: Role; displayName?: string }> => {
  if (!db) return {};

  try {
    // 1️⃣ Buscar documento en barberos
    const barberDoc = await getDoc(doc(db, BARBERS_COLLECTION, uid));
    if (barberDoc.exists()) {
      const data = barberDoc.data();
      return {
        role: normalizeRoleValue(data.role) ?? "barbero",
        displayName: extractName(data),
      };
    }

    // 2️⃣ Buscar documento en users
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        role: normalizeRoleValue(data.role) ?? "barbero",
        displayName: extractName(data),
      };
    }

    // 3️⃣ Fallback por email (por si el admin no usó UID)
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail) {
      const q1 = query(collection(db, USERS_COLLECTION), where("emailLower", "==", normalizedEmail), limit(1));
      const q2 = query(collection(db, BARBERS_COLLECTION), where("emailLower", "==", normalizedEmail), limit(1));

      const [usersSnap, barbersSnap] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const docSnap = usersSnap.docs[0] || barbersSnap.docs[0];
      if (docSnap) {
        const data = docSnap.data();
        return {
          role: normalizeRoleValue(data.role) ?? "barbero",
          displayName: extractName(data),
        };
      }
    }

    return {};
  } catch (error) {
    console.error("Error al obtener perfil del usuario:", error);
    return {};
  }
};

const toFirebaseUser = (demo: DemoUser): User =>
  ({
    uid: demo.id,
    email: demo.email,
    displayName: demo.displayName,
  } as unknown as User);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | undefined>();
  const [profileName, setProfileName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setRole(undefined);
      setProfileName(undefined);
      setLoading(false);
      setDemoMode(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setRole(undefined);
        setProfileName(undefined);
        setLoading(false);
        setDemoMode(false);
        return;
      }

      // ✅ Usuario autenticado → cargar rol desde Firestore
      const fallbackRole =
        normalizeEmail(firebaseUser.email) === FALLBACK_ADMIN_EMAIL ? "admin" : undefined;

      const profile = await resolveProfileFromDb(firebaseUser.uid, firebaseUser.email);
      const finalRole = profile.role || fallbackRole || "barbero";
      const finalName =
        profile.displayName || firebaseUser.displayName || firebaseUser.email || undefined;

      setUser(firebaseUser);
      setRole(finalRole);
      setProfileName(finalName);
      setLoading(false);
      setDemoMode(false);
    });

    return () => unsubscribe();
  }, []);

  const loginDemo = (userId: string) => {
    const account = listDemoUsers().find((u) => u.id === userId);
    if (!account) return;
    setUser(toFirebaseUser(account));
    setRole(account.role);
    setProfileName(account.displayName);
    setDemoMode(true);
    setLoading(false);
  };

  const logout = async () => {
    if (auth) await signOut(auth);
    setUser(null);
    setRole(undefined);
    setProfileName(undefined);
    setLoading(false);
    setDemoMode(false);
  };

  return (
    <AuthCtx.Provider value={{ user, role, profileName, loading, demoMode, loginDemo, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
