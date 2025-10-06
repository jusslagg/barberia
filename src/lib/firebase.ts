import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const fallbackConfig = {
  apiKey: "AIzaSyDMJN4-PWQMH-8PFmr9nL0kNdI2hr5DY9E",
  authDomain: "barberia-7ac00.firebaseapp.com",
  projectId: "barberia-7ac00",
  storageBucket: "barberia-7ac00.firebasestorage.app",
  messagingSenderId: "301206293641",
  appId: "1:301206293641:web:6d31c24c1331398ebdca58",
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

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else if (import.meta.env.DEV) {
  console.warn("Firebase config faltante: ejecutando en modo demostracion");
}

export { auth, db, isFirebaseConfigured };

