import { addDoc, collection, getDocs, limit, orderBy, query, startAfter, type DocumentSnapshot, where, serverTimestamp } from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { db } from "../lib/firebase";
import { createDemoClient, listDemoClients } from "../lib/demoData";
import type { Client } from "../types";
import debounce from "../utils/debounce";

const PAGE_SIZE = 10;
const searchLimitSuffix = "\uF8FF";

export default function ClientsList() {
  const { user, role } = useAuth();
  const isDemo = !db;
  const canManage = role === "admin" || role === "barbero";

  const [onlyMine, setOnlyMine] = useState(false);
  const [qText, setQText] = useState("");
  const [rows, setRows] = useState<Client[]>(() => (isDemo ? listDemoClients() : []));
  const [cursorStack, setCursorStack] = useState<DocumentSnapshot[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(() => !isDemo);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runDemoFilter = () => {
    const text = qText.trim().toLowerCase();
    let filtered = listDemoClients();
    if (onlyMine && user) filtered = filtered.filter((c) => c.mainBarberId === user.uid);
    if (text) filtered = filtered.filter((c) => c.fullName.toLowerCase().includes(text));
    setRows(filtered);
    setHasNext(false);
    setLoading(false);
  };

  const doFetch = async (direction: "first" | "next" | "prev") => {
    if (!db) {
      runDemoFilter();
      return;
    }

    setLoading(true);
    const clients = collection(db, "clients");
    const base = onlyMine && user ? query(clients, where("mainBarberId", "==", user.uid)) : clients;

    let qRef = base;
    const text = qText.trim().toLowerCase();
    if (text) {
      const end = `${text}${searchLimitSuffix}`;
      qRef = query(
        base,
        where("fullName_lower", ">=", text),
        where("fullName_lower", "<=", end),
        orderBy("fullName_lower"),
        limit(PAGE_SIZE)
      );
    } else {
      qRef = query(base, orderBy("fullName"), limit(PAGE_SIZE));
    }

    if (direction === "next" && lastDoc) {
      qRef = query(qRef, startAfter(lastDoc));
    } else if (direction === "prev") {
      const prevStack = [...cursorStack];
      const prevCursor = prevStack.splice(-2, 1)[0];
      setCursorStack(prevStack);
      const base2 = onlyMine && user ? query(clients, where("mainBarberId", "==", user.uid)) : clients;
      const text2 = qText.trim().toLowerCase();
      let qRef2 = text2
        ? query(
            base2,
            where("fullName_lower", ">=", text2),
            where("fullName_lower", "<=", `${text2}${searchLimitSuffix}`),
            orderBy("fullName_lower"),
            limit(PAGE_SIZE)
          )
        : query(base2, orderBy("fullName"), limit(PAGE_SIZE));
      if (prevCursor) qRef = query(qRef2, startAfter(prevCursor));
    }

    const snap = await getDocs(qRef);
    const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    setRows(data as Client[]);
    setLastDoc(snap.docs[snap.docs.length - 1] || null);
    setHasNext(snap.docs.length === PAGE_SIZE);
    if (direction !== "prev") {
      setCursorStack((stack) => {
        const firstDoc = snap.docs[0];
        return firstDoc ? [...stack, firstDoc] : stack;
      });
    }
    setLoading(false);
  };

  const debounced = useMemo(() => debounce(() => void doFetch("first"), 350), [onlyMine, user, db]);

  useEffect(() => {
    if (!db) {
      runDemoFilter();
      return;
    }
    void doFetch("first");
  }, [onlyMine]);

  useEffect(() => {
    if (!db) {
      runDemoFilter();
      return;
    }
    debounced();
  }, [qText, debounced]);

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
        runDemoFilter();
      } else {
        const payload: Record<string, any> = {
          fullName,
          fullName_lower: fullName.toLowerCase(),
          mainBarberId: user?.uid || "",
          notes: "",
          createdAt: serverTimestamp(),
        };
        if (phone) payload.phone = phone;
        await addDoc(collection(db, "clients"), payload);
        await doFetch("first");
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
        {!loading &&
          displayRows.map((client) => (
            <Link key={client.id} to={`/clientes/${client.id}`} className="list-item">
              <div className="avatar">{client.fullName.split(" ").map((part) => part[0]).slice(0, 2)}</div>
              <div className="flex-1">
                <div className="title">{client.fullName}</div>
                {client.phone && <div className="sub">{client.phone}</div>}
              </div>
              <span className="sub">Ver</span>
            </Link>
          ))}
        {!loading && displayRows.length === 0 && <div className="text-[var(--ink-soft)] text-sm">No encontramos coincidencias.</div>}
      </section>

      {!isDemo && (
        <footer className="flex items-center justify-between">
          <button className="btn btn-ghost" onClick={() => void doFetch("prev")} disabled={cursorStack.length <= 1}>
            Anterior
          </button>
          <button className="btn btn-primary" onClick={() => void doFetch("next")} disabled={!hasNext}>
            Siguiente
          </button>
        </footer>
      )}

      <p className="text-xs text-[var(--ink-soft)]">
        Tip: para busquedas rapidas, agrega el campo <code>fullName_lower</code> en minusculas en tus documentos.
      </p>
    </div>
  );
}
