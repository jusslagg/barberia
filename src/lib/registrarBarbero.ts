import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

type NuevoBarbero = {
  displayName: string;
  email: string;
  password: string;
};

export async function registrarBarbero(data: NuevoBarbero) {
  if (!auth || !db) {
    return { success: false, message: "Firebase no está inicializado." };
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const uid = cred.user.uid;

    await setDoc(doc(db, "barberos", uid), {
      email: data.email.toLowerCase(),
      displayName: data.displayName,
      role: "barbero",
      createdAt: serverTimestamp(),
    });

    console.log("✅ Barbero registrado correctamente:", data.email);
    return { success: true, uid };
  } catch (error) {
    console.error("❌ Error al registrar barbero:", error);
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "auth/email-already-in-use") {
      return { success: false, message: "El correo ya está registrado." };
    }
    const message = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, message };
  }
}
