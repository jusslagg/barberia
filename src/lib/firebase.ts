import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

const fallbackConfig = {
  apiKey: "AIzaSyBhrcZwtoUXgdlh1o9hmVN3COZjuKBW4lM",
  authDomain: "barberia-20938.firebaseapp.com",
  projectId: "barberia-20938",
  storageBucket: "barberia-20938.firebasestorage.app",
  messagingSenderId: "846907688289",
  appId: "1:846907688289:web:cd14404104465d72d17120",
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
  } catch (error) {
    resolvedFirebase = false;
    console.error("No se pudo inicializar Firebase, se usara modo demostracion.", error);
  }
} else if (import.meta.env.DEV) {
  console.warn("Firebase config faltante: ejecutando en modo demostracion");
}

export { auth, db, resolvedFirebase as isFirebaseConfigured };
