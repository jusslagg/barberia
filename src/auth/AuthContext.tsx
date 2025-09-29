import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { Role } from "../types";
import { auth, db, isFirebaseConfigured } from "../lib/firebase";
import { listDemoUsers, type DemoUser } from "../lib/demoData";

interface AuthContextValue {
  user: User | null;
  role?: Role;
  loading: boolean;
  demoMode: boolean;
  loginDemo: (userId: string) => void;
  logout: () => Promise<void>;
}

const noop = async () => {};

const AuthCtx = createContext<AuthContextValue>({
  user: null,
  role: undefined,
  loading: true,
  demoMode: !isFirebaseConfigured,
  loginDemo: () => undefined,
  logout: noop,
});

export const useAuth = () => useContext(AuthCtx);

type InternalState = {
  user: User | null;
  role?: Role;
  loading: boolean;
  demoMode: boolean;
};

const initialState: InternalState = {
  user: null,
  role: undefined,
  loading: true,
  demoMode: !isFirebaseConfigured,
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
      setState({ user: null, role: undefined, loading: false, demoMode: true });
      return;
    }

    const unsubscribe = onAuthStateChangedWithRole();
    return () => unsubscribe();
  }, []);

  const onAuthStateChangedWithRole = () =>
    auth!.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setState({ user: null, role: undefined, loading: false, demoMode: false });
        return;
      }

      if (!db) {
        setState({ user: firebaseUser, role: undefined, loading: false, demoMode: false });
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        const role = snap.data()?.role as Role | undefined;
        setState({ user: firebaseUser, role, loading: false, demoMode: false });
      } catch (error) {
        console.error("No se pudo obtener el rol del usuario", error);
        setState({ user: firebaseUser, role: undefined, loading: false, demoMode: false });
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
        loading: false,
        demoMode: true,
      };
    });
  };

  const logout = async () => {
    if (!auth || !isFirebaseConfigured) {
      setState({ user: null, role: undefined, loading: false, demoMode: true });
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
