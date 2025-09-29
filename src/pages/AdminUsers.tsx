import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { db } from "../lib/firebase";
import { createDemoUser, deleteDemoUser, listDemoUsers, updateDemoUser } from "../lib/demoData";
import type { Role } from "../types";

type Row = { id: string; displayName?: string; email?: string; role?: Role };

type FormState = { id?: string; displayName: string; email: string; role: Role };

const emptyForm: FormState = { displayName: "", email: "", role: "barbero" };

export default function AdminUsers() {
  const { role, loading } = useAuth();
  const isDemo = !db;
  const [rows, setRows] = useState<Row[]>(() => (isDemo ? listDemoUsers() : []));
  const [qText, setQText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setRows(listDemoUsers());
      return;
    }

    const load = async () => {
      const snap = await getDocs(query(collection(db, "users"), orderBy("displayName")));
      setRows(snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) })));
    };

    void load();
  }, [db]);

  const filtered = rows.filter((item) => (item.displayName || item.email || "").toLowerCase().includes(qText.toLowerCase()));

  const openForm = (row?: Row) => {
    if (row) {
      setForm({ id: row.id, displayName: row.displayName || "", email: row.email || "", role: (row.role as Role) || "barbero" });
    } else {
      setForm(emptyForm);
    }
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.displayName.trim() || !form.email.trim()) {
      setErrorMsg("Nombre y correo son obligatorios.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      if (!db) {
        if (form.id) {
          updateDemoUser(form.id, {
            displayName: form.displayName.trim(),
            email: form.email.trim(),
            role: form.role,
          });
        } else {
          createDemoUser({ displayName: form.displayName.trim(), email: form.email.trim(), role: form.role });
        }
        setRows(listDemoUsers());
      } else if (form.id) {
        await updateDoc(doc(db, "users", form.id), {
          displayName: form.displayName.trim(),
          email: form.email.trim(),
          role: form.role,
        });
        setRows((prev) =>
          prev.map((row) => (row.id === form.id ? { ...row, ...form, displayName: form.displayName.trim(), email: form.email.trim() } : row))
        );
      } else {
        const newDoc = await addDoc(collection(db, "users"), {
          displayName: form.displayName.trim(),
          email: form.email.trim(),
          role: form.role,
        });
        setRows((prev) => [{ id: newDoc.id, ...form, displayName: form.displayName.trim(), email: form.email.trim() }, ...prev]);
      }
      setShowForm(false);
      setForm(emptyForm);
    } catch (error) {
      console.error("No pudimos guardar el usuario", error);
      setErrorMsg("No pudimos guardar el usuario.");
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (id: string, newRole: Role) => {
    if (!db) {
      updateDemoUser(id, { role: newRole });
      setRows(listDemoUsers());
      return;
    }
    await updateDoc(doc(db, "users", id), { role: newRole });
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, role: newRole } : row)));
  };

  const removeUser = async (id: string) => {
    const confirmed = window.confirm("Seguro que deseas eliminar este usuario?");
    if (!confirmed) return;

    try {
      if (!db) {
        deleteDemoUser(id);
        setRows(listDemoUsers());
      } else {
        await deleteDoc(doc(db, "users", id));
        setRows((prev) => prev.filter((row) => row.id !== id));
      }
    } catch (error) {
      console.error("No pudimos eliminar el usuario", error);
      alert("No pudimos eliminar el usuario.");
    }
  };

  if (loading) {
    return <div className="panel">Cargando...</div>;
  }

  if (role !== "admin") {
    return <div className="panel text-[var(--ink)]">No tienes permisos para ver esta pagina.</div>;
  }

  return (
    <div className="panel space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.5em] text-[var(--ink-soft)]">Equipo</span>
          <h1 className="text-3xl font-semibold text-[var(--ink)]">Administracion de usuarios</h1>
          <p className="text-sm text-[var(--ink-soft)] max-w-2xl">
            Agrega barberos, otorga permisos de administrador y mantén actualizado el directorio interno.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-60"
            placeholder="Buscar"
            value={qText}
            onChange={(event) => setQText(event.target.value)}
          />
          <button className="btn btn-primary" onClick={() => openForm()}>
            Nuevo usuario
          </button>
        </div>
      </header>

      {showForm && (
        <form
          className="grid gap-4 bg-[var(--cream-strong)] border border-[var(--border-soft)] rounded-2xl p-5"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Nombre</label>
              <input
                className="input mt-1"
                value={form.displayName}
                onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Correo</label>
              <input
                className="input mt-1"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Rol</label>
              <select
                className="input mt-1"
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as Role }))}
              >
                <option value="barbero">barbero</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
          {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Actualizar" : "Agregar"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
          {isDemo && <p className="text-xs text-[var(--ink-soft)]">Datos de ejemplo: no requieren Firebase.</p>}
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-[var(--ink)]">
          <thead>
            <tr className="text-left text-[var(--ink-soft)]">
              <th className="py-2 pr-3 font-semibold">Nombre</th>
              <th className="py-2 pr-3 font-semibold">Email</th>
              <th className="py-2 pr-3 font-semibold">Rol</th>
              <th className="py-2 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(44,21,10,0.08)]">
            {filtered.map((userRow) => (
              <tr key={userRow.id} className="bg-[rgba(244,237,225,0.85)]">
                <td className="py-3 pr-3 font-medium">{userRow.displayName || "-"}</td>
                <td className="py-3 pr-3">{userRow.email || "-"}</td>
                <td className="py-3 pr-3 uppercase tracking-[0.25em] text-xs">{userRow.role}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="input max-w-[130px]"
                      value={userRow.role}
                      onChange={(event) => changeRole(userRow.id, event.target.value as Role)}
                    >
                      <option value="barbero">barbero</option>
                      <option value="admin">admin</option>
                    </select>
                    <button className="btn btn-ghost" type="button" onClick={() => openForm(userRow)}>
                      Editar
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => void removeUser(userRow.id)}>
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="text-sm text-[var(--ink-soft)] mt-3">No hay usuarios para mostrar.</p>}
      </div>

      <p className="text-xs text-[var(--ink-soft)]">
        Nota: la creacion de usuarios (Auth) se hace desde Firebase console; aqui administras los perfiles y roles.
      </p>
    </div>
  );
}
