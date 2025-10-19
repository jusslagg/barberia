
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { db } from "../lib/firebase";
import { createDemoClient, listDemoClients, listDemoPhotos } from "../lib/demoData";
import type { Client } from "../types";
import { notesToSearchText, toNoteOptionArray } from "../utils/noteOptions";

const CLIENTS_COLLECTION = "clientes";
const PORTFOLIO_COLLECTION = "public_portfolio";

const normalizeClient = (docId: string, raw: Record<string, any>, fallbackOwner?: string | null): Client => {
  const first = raw.fullName || raw.fullname || raw.nombre || raw.Nombre || "";
  const last = raw.lastName || raw.apellido || raw.Apellido || "";
  const combined = `${first} ${last}`.trim();
  const fullName = combined || first || last || docId;
  const mainBarberId =
    raw.mainBarberId || raw.barberId || raw.barberoId || raw.ownerId || fallbackOwner || "";
  return {
    id: docId,
    fullName,
    fullName_lower: raw.fullName_lower || fullName.toLowerCase(),
    phone: raw.phone || raw.telefono || raw.Telefono || "",
    mainBarberId,
    notes: toNoteOptionArray(raw.notes ?? raw.Informacion ?? raw.info),
    createdAt: raw.createdAt ?? null,
  };
};

const applyFilters = (source: Client[], text: string, onlyMine: boolean, ownerId?: string | null) => {
  const query = text.trim().toLowerCase();
  return source.filter((client) => {
    if (onlyMine && ownerId) {
      if (client.mainBarberId && client.mainBarberId !== ownerId) return false;
    }
    if (!query) return true;
    const name = (client.fullName || "").toLowerCase();
    const phone = (client.phone || "").toLowerCase();
    const notes = notesToSearchText(client.notes).toLowerCase();
    return name.includes(query) || phone.includes(query) || notes.includes(query);
  });
};

export default function ClientsList() {
  const { user, role } = useAuth();
  const isDemo = !db;
  const canManage = role === "admin" || role === "barbero";

  const [onlyMine, setOnlyMine] = useState(false);
  const [qText, setQText] = useState("");
  const [allRows, setAllRows] = useState<Client[]>(() => (isDemo ? listDemoClients() : []));
  const [rows, setRows] = useState<Client[]>(() => applyFilters(allRows, qText, onlyMine, user?.uid));
  const [loading, setLoading] = useState(() => !isDemo);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientPhotos, setClientPhotos] = useState<Record<string, string>>({});

  const loadClientThumbnails = useCallback(async (): Promise<Record<string, string>> => {
    if (isDemo || !db) {
      const mapping: Record<string, string> = {};
      const demoClients = listDemoClients();
      demoClients.forEach((client) => {
        const photos = listDemoPhotos(client.id);
        if (!photos.length) return;
        const oldest = photos[photos.length - 1] ?? photos[0];
        if (oldest?.url) {
          mapping[client.id] = oldest.url;
        }
      });
      return mapping;
    }

    try {
      const database = db!;
      const snapshot = await getDocs(collection(database, PORTFOLIO_COLLECTION));
      const byClient: Record<string, { url: string; createdAt: number }> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const rawClientId = data.clientId ?? data.client_id ?? data.clienteId;
        const clientId = typeof rawClientId === "string" && rawClientId ? rawClientId : null;
        const url = typeof data.url === "string" && data.url ? data.url : null;
        if (!clientId || !url) return;
        const createdAtRaw = data.createdAt;
        const createdAt =
          typeof createdAtRaw?.toMillis === "function"
            ? createdAtRaw.toMillis()
            : typeof createdAtRaw === "number"
              ? createdAtRaw
              : Number.MAX_SAFE_INTEGER;
        const current = byClient[clientId];
        if (!current || createdAt < current.createdAt) {
          byClient[clientId] = { url, createdAt };
        }
      });
      return Object.fromEntries(Object.entries(byClient).map(([clientId, info]) => [clientId, info.url]));
    } catch (error) {
      console.error("No pudimos cargar las imagenes de portada de los clientes.", error);
      return {};
    }
  }, [isDemo, db]);

  const refreshDemoData = useCallback(() => {
    const demo = listDemoClients();
    setAllRows(demo);
    setRows(applyFilters(demo, qText, onlyMine, user?.uid));
    setLoading(false);
    setLoadError(null);
    void loadClientThumbnails().then((map) => setClientPhotos(map));
  }, [onlyMine, qText, user?.uid, loadClientThumbnails]);

  const fetchClients = useCallback(async () => {
    if (!db) {
      refreshDemoData();
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const database = db;
      if (!database) {
        refreshDemoData();
        return;
      }
      const snap = await getDocs(collection(database, CLIENTS_COLLECTION));
      const mapped = snap.docs.map((doc) => normalizeClient(doc.id, doc.data() as any, user?.uid));
      const sorted = mapped.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setAllRows(sorted);
      const photoMap = await loadClientThumbnails();
      setClientPhotos(photoMap);
    } catch (error) {
      console.error("No pudimos cargar clientes", error);
      setAllRows([]);
      setLoadError("No pudimos sincronizar clientes. Verifica tu conexion o indices de Firestore.");
    } finally {
      setLoading(false);
    }
  }, [refreshDemoData, user?.uid]);

  useEffect(() => {
    if (isDemo) {
      refreshDemoData();
      return;
    }
    void fetchClients();
  }, [isDemo, fetchClients, refreshDemoData]);

  useEffect(() => {
    if (isDemo) {
      const demo = listDemoClients();
      setRows(applyFilters(demo, qText, onlyMine, user?.uid));
      return;
    }
    setRows(applyFilters(allRows, qText, onlyMine, user?.uid));
  }, [qText, onlyMine, allRows, user?.uid, isDemo]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();

    if (!fullName) {
      setErrorMsg("El nombre es obligatorio.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      if (!db) {
        createDemoClient({ fullName, phone, mainBarberId: user?.uid });
        refreshDemoData();
      } else {
        await addDoc(collection(db, CLIENTS_COLLECTION), {
          fullName,
          fullName_lower: fullName.toLowerCase(),
          phone: phone || undefined,
          mainBarberId: user?.uid || "",
          notes: [],
          createdAt: serverTimestamp(),
        });
        await fetchClients();
      }
      setForm({ fullName: "", phone: "" });
      setShowForm(false);
    } catch (error) {
      console.error("No pudimos crear el cliente", error);
      setErrorMsg("No pudimos crear el cliente. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const displayRows = rows;

  return (
    <div className="panel space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.55em] text-[var(--ink-soft)]">Agenda</span>
          <h1 className="text-3xl font-semibold text-[var(--ink)]">Clientes frecuentes</h1>
          <p className="text-sm text-[var(--ink-soft)] max-w-xl">
            Gestiona la informacion de tus visitas, agrega nuevos perfiles y mantente al dia con sus preferencias.
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cerrar formulario" : "Nuevo cliente"}
          </button>
        )}
      </header>

      <section className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <input
            className="searchbar"
            placeholder="Buscar cliente"
            value={qText}
            onChange={(event) => setQText(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={() => setOnlyMine((value) => !value)}
              className="accent-[var(--accent)] w-4 h-4"
            />
            Mis clientes
          </label>
        </div>

        {showForm && canManage && (
          <form
            className="grid gap-3 bg-[var(--cream-strong)] border border-[var(--border-soft)] rounded-2xl p-4 md:p-6"
            onSubmit={handleSubmit}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Nombre completo</label>
                <input
                  className="input mt-1"
                  placeholder="Ej. Juan Perez"
                  value={form.fullName}
                  onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Telefono (opcional)</label>
                <input
                  className="input mt-1"
                  placeholder="Ej. 555 0101"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
            </div>
            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="space-y-3">
        {loading && <div className="text-[var(--ink-soft)]">Cargando...</div>}
        {loadError && !loading && <div className="text-sm text-red-600">{loadError}</div>}
        {!loading &&
          !loadError &&
          displayRows.map((client) => {
            const coverUrl = clientPhotos[client.id];
            const initials =
              client.fullName
                .split(" ")
                .filter(Boolean)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("")
                .slice(0, 2) || "?";
            return (
              <Link key={client.id} to={`/clientes/${client.id}`} className="list-item">
                <div className={`avatar${coverUrl ? " has-photo" : ""}`}>
                  {coverUrl ? <img src={coverUrl} alt={`Foto de ${client.fullName}`} /> : initials}
                </div>
                <div className="flex-1">
                  <div className="title">{client.fullName}</div>
                  {client.phone && <div className="sub">{client.phone}</div>}
                </div>
                <span className="sub">Ver</span>
              </Link>
            );
          })}
        {!loading && !loadError && displayRows.length === 0 && <div className="text-[var(--ink-soft)] text-sm">No encontramos coincidencias.</div>}
      </section>

      {!isDemo && (
        <footer className="flex items-center justify-end">
          <button className="btn btn-ghost" type="button" onClick={() => void fetchClients()} disabled={loading}>
            Actualizar
          </button>
        </footer>
      )}

      <p className="text-xs text-[var(--ink-soft)]">
        Tip: para busquedas rapidas, agrega el campo <code>fullName_lower</code> en minusculas en tus documentos.
      </p>
    </div>
  );
}

