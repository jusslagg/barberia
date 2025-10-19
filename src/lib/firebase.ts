import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const fallbackConfig = {
  apiKey: "AIzaSyC1ciO4ZxGRNcx4Q87BxJa0y7lFpsvKurc",
  authDomain: "barberia-7ac00.firebaseapp.com",
  projectId: "barberia-7ac00",
  storageBucket: "barberia-7ac00.appspot.com",
  messagingSenderId: "301206293641",
  appId: "1:301206293641:web:c9635693f4519d3dbdca58",
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
};

const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let app: FirebaseApp | undefined;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let resolvedFirebase = isFirebaseConfigured;

if (isFirebaseConfigured) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    try {
      const firestoreSettings = {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      } as Record<string, unknown>;
      db = initializeFirestore(app, {
        ...firestoreSettings,
      } as Parameters<typeof initializeFirestore>[1]);
    } catch (firestoreError) {
      const code =
        typeof firestoreError === "object" && firestoreError && "code" in firestoreError
          ? String((firestoreError as { code?: string }).code || "").toLowerCase()
          : "";
      if (code !== "failed-precondition") {
        throw firestoreError;
      }
      db = getFirestore(app);
    }
    storage = getStorage(app);

  } catch (error) {
    resolvedFirebase = false;
    console.error("No se pudo inicializar Firebase, se usara modo demostracion.", error);
  }
} else if (import.meta.env.DEV) {
  console.warn("Firebase config faltante: ejecutando en modo demostracion");
}

try {
  // @ts-ignore
  (window as any).__fb = { auth, db };
  console.log("🔥 Firebase projectId =>", auth?.app?.options?.projectId);
} catch {}

export { auth, db, storage, resolvedFirebase as isFirebaseConfigured };
