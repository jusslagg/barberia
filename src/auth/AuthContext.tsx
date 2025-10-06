
import { signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { Role } from "../types";
import { auth, db, isFirebaseConfigured } from "../lib/firebase";
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

const noop = async () => {};

const AuthCtx = createContext<AuthContextValue>({
  user: null,
  role: undefined,
  profileName: undefined,
  loading: true,
  demoMode: !isFirebaseConfigured,
  loginDemo: () => undefined,
  logout: noop,
});

export const useAuth = () => useContext(AuthCtx);

type InternalState = {
  user: User | null;
  role?: Role;
  profileName?: string;
  loading: boolean;
  demoMode: boolean;
};

const initialState: InternalState = {
  user: null,
  role: undefined,
  profileName: undefined,
  loading: true,
  demoMode: !isFirebaseConfigured,
};

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() || null;

type ResolvedProfile = { role?: Role; displayName?: string };

const extractName = (data: Record<string, any> | undefined | null): string | undefined => {
  if (!data) return undefined;
  const primary = data.displayName || data.nombre || data.Nombre;
  const last = data.lastName || data.apellido || data.Apellido;
  if (primary && last) return `${primary} ${last}`.trim();
  if (primary) return primary;
  if (last) return last;
  return undefined;
};

const resolveProfileFromDb = async (uid: string, email?: string | null): Promise<ResolvedProfile> => {
  if (!db) return {};

  const userDoc = await getDoc(doc(db!, USERS_COLLECTION, uid));
  const directData = userDoc.data() as Record<string, any> | undefined;
  const directRole = (directData?.role as Role | undefined) || undefined;
  const directName = extractName(directData);
  if (directRole || directName) return { role: directRole, displayName: directName };

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    const queries = [
      query(collection(db!, USERS_COLLECTION), where("email", "==", normalizedEmail), limit(1)),
      query(collection(db!, BARBERS_COLLECTION), where("email", "==", normalizedEmail), limit(1)),
    ];

    for (const qRef of queries) {
      const snap = await getDocs(qRef);
      const docSnap = snap.docs[0];
      if (docSnap) {
        const data = docSnap.data() as Record<string, any> | undefined;
        const role = (data?.role as Role | undefined) || undefined;
        const name = extractName(data);
        if (role || name) return { role, displayName: name };
      }
    }
  }

  const barberDoc = await getDoc(doc(db!, BARBERS_COLLECTION, uid));
  const barberData = barberDoc.data() as Record<string, any> | undefined;
  const role = (barberData?.role as Role | undefined) || undefined;
  const name = extractName(barberData);
  return { role, displayName: name };
};

const toFirebaseUser = (demo: DemoUser): User =>
  ({
    uid: demo.id,
    email: demo.email,
    displayName: demo.displayName,
  } as unknown as User);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InternalState>(initialState);

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setState({ user: null, role: undefined, profileName: undefined, loading: false, demoMode: true });
      return;
    }

    const unsubscribe = onAuthStateChangedWithProfile();
    return () => unsubscribe();
  }, []);

  const onAuthStateChangedWithProfile = () =>
    auth!.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setState({ user: null, role: undefined, profileName: undefined, loading: false, demoMode: false });
        return;
      }

      const fallbackRole = normalizeEmail(firebaseUser.email) === FALLBACK_ADMIN_EMAIL ? "admin" : undefined;

      try {
        const profile = await resolveProfileFromDb(firebaseUser.uid, firebaseUser.email);
        const finalRole = profile.role || fallbackRole;
        const profileName = profile.displayName || firebaseUser.displayName || firebaseUser.email || undefined;
        setState({ user: firebaseUser, role: finalRole, profileName, loading: false, demoMode: false });
      } catch (error) {
        console.error("No se pudo obtener el rol del usuario", error);
        setState({
          user: firebaseUser,
          role: fallbackRole,
          profileName: firebaseUser.displayName || firebaseUser.email || undefined,
          loading: false,
          demoMode: false,
        });
      }
    });

  const loginDemo = (userId: string) => {
    setState((prev) => {
      if (!prev.demoMode) return prev;
      const account = listDemoUsers().find((u) => u.id === userId);
      if (!account) return prev;
      return {
        user: toFirebaseUser(account),
        role: account.role,
        profileName: account.displayName,
        loading: false,
        demoMode: true,
      };
    });
  };

  const logout = async () => {
    if (!auth || !isFirebaseConfigured) {
      setState({ user: null, role: undefined, profileName: undefined, loading: false, demoMode: true });
      return;
    }
    try {
      await signOut(auth);
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  return <AuthCtx.Provider value={{ ...state, loginDemo, logout }}>{children}</AuthCtx.Provider>;
}
