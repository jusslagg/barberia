import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PhotoGrid, { type PhotoItem } from "../components/PhotoGrid";
import Uploader from "../components/Uploader";
import { useAuth } from "../auth/AuthContext";
import { db } from "../lib/firebase";
import { deleteImageByToken, isCloudinaryConfigured, type UploadedAsset } from "../lib/uploadCloudinary";
import {
  deleteDemoClient,
  deleteDemoPhoto,
  getDemoClient,
  listDemoPhotos,
  pushDemoPhoto,
  updateDemoClient,
  type DemoPhoto,
} from "../lib/demoData";

const CLIENTS_COLLECTION = "clientes";
const CUTS_COLLECTION = "cuts";

type StoredPhotoValue = {
  url: string;
  deleteToken: string | null;
  barberId?: string;
};

type ClientPhoto = PhotoItem & {
  key: string;
  cutId?: string;
  rawValue?: StoredPhotoValue;
  docHasSinglePhoto?: boolean;
  demoId?: string;
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role, demoMode } = useAuth();
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [form, setForm] = useState({ fullName: "", phone: "", notes: "" });
  const [clientExists, setClientExists] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [deletingPhotoKey, setDeletingPhotoKey] = useState<string | null>(null);

  const isDemo = !db;
  const canManage = role === "admin" || role === "barbero";
  const cloudReady = isCloudinaryConfigured;
  const uploadFolder = isDemo ? "demo" : id ? `clientes/${id}` : "clientes";

  const mapDemoPhotos = (items: DemoPhoto[]): ClientPhoto[] =>
    items.map((photo) => ({
      key: photo.id,
      id: photo.id,
      url: photo.url,
      deleteToken: photo.deleteToken ?? null,
      barberId: photo.barberId,
      demoId: photo.id,
    }));

const normalizeStoredPhoto = (
  entry: unknown,
  fallbackBarberId?: string,
): {
  url: string;
  deleteToken: string | null;
  barberId?: string;
  rawValue: StoredPhotoValue;
  needsMigration: boolean;
} | null => {
  if (typeof entry === "string") {
    const payload: StoredPhotoValue = { url: entry, deleteToken: null };
    if (fallbackBarberId) payload.barberId = fallbackBarberId;
    return {
      url: entry,
      deleteToken: null,
      barberId: fallbackBarberId,
      rawValue: payload,
      needsMigration: true,
    };
  }
  if (entry && typeof entry === "object") {
    const record = entry as Record<string, any>;
    const urlCandidate =
      typeof record.url === "string"
        ? record.url
        : typeof record.secure_url === "string"
            ? record.secure_url
            : typeof record.path === "string"
              ? record.path
              : "";
    if (!urlCandidate) return null;
    const rawDeleteToken =
      typeof record.deleteToken === "string"
        ? record.deleteToken
        : typeof record.delete_token === "string"
            ? record.delete_token
            : null;
    const normalizedDeleteToken = rawDeleteToken ?? null;
    const hasRecordBarberId = typeof record.barberId === "string" && record.barberId.trim().length > 0;
    const recordBarberId = hasRecordBarberId ? record.barberId.trim() : fallbackBarberId;
    const payload: StoredPhotoValue = { url: urlCandidate, deleteToken: normalizedDeleteToken };
    if (recordBarberId) payload.barberId = recordBarberId;
    const shouldAddBarberId = !hasRecordBarberId && Boolean(fallbackBarberId);
    const needsMigration =
      shouldAddBarberId ||
      typeof record.deleteToken === "undefined" ||
      typeof record.delete_token === "string";
    return {
      url: urlCandidate,
      deleteToken: normalizedDeleteToken,
      barberId: recordBarberId,
      rawValue: payload,
      needsMigration,
    };
  }
  return null;
};

  const removePhotoLocally = (photoKey: string) => {
    setPhotos((prev) => prev.filter((item) => item.key !== photoKey));
  };

  const handleDeletePhoto = async (photo: ClientPhoto) => {
    if (!id || deletingPhotoKey) return;
    const confirmDelete = window.confirm("Seguro que deseas eliminar esta foto?");
    if (!confirmDelete) return;

    setPhotoError(null);
    setDeletingPhotoKey(photo.key);

    try {
      if (isDemo) {
        if (photo.demoId) {
          deleteDemoPhoto(id, photo.demoId);
        }
        removePhotoLocally(photo.key);
        return;
      }

      if (!photo.deleteToken) {
        throw new Error("No podemos eliminar esta imagen porque se subio antes de activar los tokens de Cloudinary.");
      }

      await deleteImageByToken(photo.deleteToken);

      if (photo.cutId) {
        const cutRef = doc(db!, CUTS_COLLECTION, photo.cutId);
        if (photo.docHasSinglePhoto) {
          await deleteDoc(cutRef);
        } else if (photo.rawValue !== undefined) {
          await updateDoc(cutRef, { photos: arrayRemove(photo.rawValue) });
        }
      }

      removePhotoLocally(photo.key);
    } catch (error) {
      console.error("No pudimos eliminar la foto", error);
      setPhotoError(
        error instanceof Error
          ? error.message
          : "No pudimos eliminar la imagen. Intenta de nuevo.",
      );
    } finally {
      setDeletingPhotoKey(null);
    }
  };

  useEffect(() => {
    if (!id) return;

    setPhotoError(null);
    setDeletingPhotoKey(null);

    if (isDemo) {
      const demoClient = getDemoClient(id);
      if (!demoClient) {
        setClientExists(false);
        return;
      }
      setClientExists(true);
      setForm({
        fullName: demoClient.fullName,
        phone: demoClient.phone == null ? "" : String(demoClient.phone),
        notes: demoClient.notes || "",
      });
      setPhotos(mapDemoPhotos(listDemoPhotos(id)));
      return;
    }

    const unsubscribe = onSnapshot(doc(db!, CLIENTS_COLLECTION, id), (snapshot) => {
      if (!snapshot.exists()) {
        setClientExists(false);
        return;
      }
      const data = snapshot.data() as any;
      setClientExists(true);
      setForm({
        fullName: data.fullName || "",
        phone: data.phone == null ? "" : String(data.phone),
        notes: data.notes || "",
      });
    });

    (async () => {
      const qRef = query(collection(db!, CUTS_COLLECTION), where("clientId", "==", id));
      const snap = await getDocs(qRef);
      const list: { photo: ClientPhoto; createdAt?: any }[] = [];
      let warnedMissingBarberId = false;
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const rawPhotos = Array.isArray(data.photos) ? data.photos : [];
        const docBarberId =
          typeof data.barberId === "string" && data.barberId.trim().length ? data.barberId.trim() : undefined;
        rawPhotos.forEach((entry, index) => {
          const normalized = normalizeStoredPhoto(entry, docBarberId);
          if (!normalized) return;
          const key = `${docSnap.id}-${index}`;
          list.push({
            photo: {
              key,
              id: key,
              url: normalized.url,
              deleteToken: normalized.deleteToken,
              cutId: docSnap.id,
              rawValue: normalized.rawValue,
              docHasSinglePhoto: rawPhotos.length <= 1,
              barberId: normalized.barberId,
            },
            createdAt: data.createdAt,
          });
          if (normalized.needsMigration && !warnedMissingBarberId) {
            warnedMissingBarberId = true;
            console.warn(
              "Se detectaron fotos antiguas sin barberId. Actualiza manualmente esos documentos si tus reglas de seguridad lo permiten.",
            );
          }
        });
      });
      list.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : Number(a.createdAt) || 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : Number(b.createdAt) || 0;
        return bTime - aTime;
      });
      setPhotos(list.map((item) => item.photo).slice(0, 12));
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

  const onUpload = async (asset: UploadedAsset) => {
    if (!id) return;
    setPhotoError(null);
    if (isDemo) {
      const updated = pushDemoPhoto(id, {
        url: asset.url,
        deleteToken: asset.deleteToken ?? null,
        barberId: user?.uid || "demo-barber",
      });
      setPhotos(mapDemoPhotos(updated).slice(0, 12));
      return;
    }
    const photoPayload = {
      url: asset.url,
      deleteToken: asset.deleteToken ?? null,
      barberId: user?.uid || "",
    };
    try {
      const docRef = await addDoc(collection(db!, CUTS_COLLECTION), {
        clientId: id,
        barberId: user?.uid || "",
        photos: [photoPayload],
        createdAt: serverTimestamp(),
      });
      const key = `${docRef.id}-0`;
      setPhotos((prev) =>
        [
          {
            key,
            id: key,
            url: asset.url,
            deleteToken: asset.deleteToken ?? null,
            cutId: docRef.id,
            rawValue: photoPayload,
            docHasSinglePhoto: true,
            barberId: user?.uid || "",
          },
          ...prev,
        ].slice(0, 12),
      );
    } catch (error) {
      console.error("No pudimos registrar la foto", error);
      setPhotoError("No pudimos guardar la foto en el cliente.");
    }
  };

  const saveClient = async () => {
    if (!id) return;
    const fullName = (form.fullName ?? "").toString().trim();
    const phone = (form.phone ?? "").toString().trim();

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
        await updateDoc(doc(db!, CLIENTS_COLLECTION, id), payload);
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
        await deleteDoc(doc(db!, CLIENTS_COLLECTION, id));
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

  const displayName = (form.fullName ?? "").toString().trim() || "Cliente sin nombre";
  const phoneText = (form.phone ?? "").toString().trim();

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
            <Uploader onUploaded={onUpload} folder={uploadFolder} />
            <span className="text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Subir nueva foto</span>
            {!cloudReady && !isDemo && (
              <span className="text-xs text-red-500">
                Configura Cloudinary en el archivo <code>.env</code> para subir las imagenes a la nube.
              </span>
            )}
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
          <PhotoGrid
            photos={photos}
            canDelete={canManage}
            onDelete={(photo) => void handleDeletePhoto(photo as ClientPhoto)}
          />
          {photoError && <p className="text-xs text-red-500">{photoError}</p>}
          {(isDemo && !demoMode) || !cloudReady ? (
            <p className="text-xs text-[var(--ink-soft)]">
              {!cloudReady
                ? "Las variables de Cloudinary no estan definidas. Usa tus credenciales para guardar las imagenes."
                : "Configura Cloudinary para guardar fotos reales."}
            </p>
          ) : null}
          {!cloudReady && (
            <p className="text-xs text-[var(--ink-soft)]">
              Mientras tanto se utilizaran imagenes de muestra temporales.
            </p>
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






