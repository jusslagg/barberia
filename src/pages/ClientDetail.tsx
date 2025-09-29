import { addDoc, collection, deleteDoc, deleteField, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PhotoGrid from "../components/PhotoGrid";
import Uploader from "../components/Uploader";
import { useAuth } from "../auth/AuthContext";
import { db } from "../lib/firebase";
import { deleteDemoClient, getDemoClient, listDemoPhotos, pushDemoPhoto, updateDemoClient } from "../lib/demoData";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role, demoMode } = useAuth();
  const [photos, setPhotos] = useState<string[]>([]);
  const [form, setForm] = useState({ fullName: "", phone: "", notes: "" });
  const [clientExists, setClientExists] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDemo = !db;
  const canManage = role === "admin" || role === "barbero";

  useEffect(() => {
    if (!id) return;

    if (isDemo) {
      const demoClient = getDemoClient(id);
      if (!demoClient) {
        setClientExists(false);
        return;
      }
      setClientExists(true);
      setForm({
        fullName: demoClient.fullName,
        phone: demoClient.phone || "",
        notes: demoClient.notes || "",
      });
      setPhotos(listDemoPhotos(id));
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "clients", id), (snapshot) => {
      if (!snapshot.exists()) {
        setClientExists(false);
        return;
      }
      const data = snapshot.data() as any;
      setClientExists(true);
      setForm({
        fullName: data.fullName || "",
        phone: data.phone || "",
        notes: data.notes || "",
      });
    });

    (async () => {
      const qRef = query(collection(db, "cuts"), where("clientId", "==", id), orderBy("createdAt", "desc"));
      const snap = await getDocs(qRef);
      const list: string[] = [];
      snap.forEach((docSnap) => {
        const items = (docSnap.data().photos || []) as string[];
        items.forEach((url) => list.push(url));
      });
      setPhotos(list.slice(0, 12));
    })();

    return () => unsubscribe();
  }, [id, isDemo]);

  const demoBanner = useMemo(() => {
    if (!isDemo) return null;
    return (
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--cream-strong)] px-4 py-3 text-sm text-[var(--ink)]">
        Estas viendo datos de ejemplo. Conecta Firebase para trabajar con informacion real.
      </div>
    );
  }, [isDemo]);

  const onUpload = async (url: string) => {
    if (!id) return;
    setPhotos((prev) => [url, ...prev]);
    if (isDemo) {
      pushDemoPhoto(id, url);
      return;
    }
    await addDoc(collection(db, "cuts"), {
      clientId: id,
      barberId: user?.uid || "",
      photos: [url],
      createdAt: serverTimestamp(),
    });
  };

  const saveClient = async () => {
    if (!id) return;
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();

    if (!fullName) {
      setErrorMsg("El nombre es obligatorio.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      if (isDemo) {
        updateDemoClient(id, { fullName, phone: phone || undefined, notes: form.notes });
      } else {
        const payload: Record<string, any> = {
          fullName,
          fullName_lower: fullName.toLowerCase(),
          notes: form.notes,
        };
        if (phone) {
          payload.phone = phone;
        } else {
          payload.phone = deleteField();
        }
        await updateDoc(doc(db, "clients", id), payload);
      }
    } catch (error) {
      console.error("No pudimos actualizar el cliente", error);
      setErrorMsg("No pudimos actualizar el cliente.");
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async () => {
    if (!id) return;
    const confirmDelete = window.confirm("Seguro que deseas eliminar este cliente?");
    if (!confirmDelete) return;

    setDeleting(true);
    setErrorMsg(null);

    try {
      if (isDemo) {
        deleteDemoClient(id);
      } else {
        await deleteDoc(doc(db, "clients", id));
      }
      navigate("/clientes");
    } catch (error) {
      console.error("No pudimos eliminar el cliente", error);
      setErrorMsg("No pudimos eliminar el cliente.");
      setDeleting(false);
    }
  };

  if (!clientExists) {
    return <div className="panel text-[var(--ink)]">No encontramos este cliente.</div>;
  }

  const displayName = form.fullName.trim() || "Cliente sin nombre";
  const phoneText = form.phone.trim();

  return (
    <div className="panel space-y-8">
      {demoBanner}

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.5em] text-[var(--ink-soft)]">Cliente</span>
          <h1 className="detail-title">{displayName}</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            {phoneText ? `Tel. ${phoneText}` : "Agrega datos de contacto y notas para personalizar cada visita."}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-col items-end gap-2">
            <Uploader onUploaded={onUpload} />
            <span className="text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Subir nueva foto</span>
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section className="grid gap-4 bg-[var(--cream-strong)] border border-[var(--border-soft)] rounded-2xl p-5">
          <h2 className="detail-sub">Ficha del cliente</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Nombre completo</label>
              <input
                className="input mt-1"
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                disabled={!canManage}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Telefono</label>
              <input
                className="input mt-1"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                disabled={!canManage}
              />
            </div>
          </div>
          {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => void saveClient()} disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button className="btn btn-ghost" onClick={() => void deleteClient()} disabled={deleting}>
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          )}
        </section>

        <section className="grid gap-4 bg-[var(--cream-strong)] border border-[var(--border-soft)] rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="detail-sub">Galeria</h2>
            {photos.length > 0 && <span className="text-xs text-[var(--ink-soft)]">{photos.length} fotos</span>}
          </div>
          <PhotoGrid photos={photos} />
          {isDemo && !demoMode && (
            <p className="text-xs text-[var(--ink-soft)]">Configura Cloudinary para guardar fotos reales.</p>
          )}
        </section>
      </div>

      <section className="grid gap-3 bg-[var(--cream-strong)] border border-[var(--border-soft)] rounded-2xl p-5">
        <h2 className="detail-sub">Notas</h2>
        <textarea
          className="input min-h-[200px]"
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          disabled={!canManage}
        />
        {canManage && (
          <button onClick={() => void saveClient()} className="btn btn-primary w-fit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar notas"}
          </button>
        )}
      </section>
    </div>
  );
}
