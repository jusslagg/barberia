import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { db } from "../lib/firebase";
import { registrarBarbero } from "../lib/registrarBarbero";
import { createDemoUser, deleteDemoUser, listDemoUsers, updateDemoUser } from "../lib/demoData";
import type { Role } from "../types";

type Row = {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailLower?: string;
  dni?: string;
  role?: Role;
};

type FormState = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  dni: string;
  role: Role;
  password: string;
};

const BARBERS_COLLECTION = "barberos";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeName = (first?: string, last?: string) => `${first ?? ""} ${last ?? ""}`.trim();

const emptyForm: FormState = { firstName: "", lastName: "", email: "", dni: "", role: "barbero", password: "" };

const mapDemoUsers = (): Row[] =>
  listDemoUsers().map((demo) => {
    const parts = (demo.displayName || "").trim().split(" ");
    const firstName = parts.shift() || demo.displayName || "";
    const lastName = parts.join(" ");
    return {
      id: demo.id,
      displayName: demo.displayName,
      firstName,
      lastName,
      email: demo.email,
      emailLower: demo.email.toLowerCase(),
      dni: demo.id.replace("demo-user-", ""),
      role: demo.role,
    };
  });

export default function AdminUsers() {
  const { role, loading } = useAuth();
  const isDemo = !db;
  const [rows, setRows] = useState<Row[]>(() => (isDemo ? mapDemoUsers() : []));
  const [qText, setQText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setRows(mapDemoUsers());
      return;
    }

    const load = async () => {
      const snap = await getDocs(query(collection(db!, BARBERS_COLLECTION), orderBy("displayName")));
      setRows(
        snap.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          const firstName = data.firstName || data.nombre || "";
          const lastName = data.lastName || data.apellido || "";
          const dni = data.dni || "";
          return {
            id: docSnap.id,
            displayName: data.displayName || normalizeName(firstName, lastName),
            firstName,
            lastName,
            email: data.email,
            emailLower: data.emailLower,
            dni,
            role: data.role as Role | undefined,
          };
        }),
      );
    };

    void load();
  }, [db]);

  const searchTerm = qText.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      rows.filter((item) => {
        if (!searchTerm) return true;
        const name = (item.displayName || normalizeName(item.firstName, item.lastName)).toLowerCase();
        const email = item.emailLower || item.email?.toLowerCase() || "";
        const dni = (item.dni || "").toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm) || dni.includes(searchTerm);
      }),
    [rows, searchTerm],
  );

  const openForm = (row?: Row) => {
    if (row) {
      const display = row.displayName || normalizeName(row.firstName, row.lastName);
      const parts = display.split(" ");
      const derivedFirst = row.firstName || parts.shift() || "";
      const derivedLast = row.lastName || parts.join(" ");
      setForm({
        id: row.id,
        firstName: derivedFirst,
        lastName: derivedLast,
        email: row.email || "",
        dni: row.dni || "",
        role: (row.role as Role) || "barbero",
        password: "",
      });
    } else {
      setForm(emptyForm);
    }
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();
    const dni = form.dni.trim();
    const password = form.password.trim();

    if (!firstName || !lastName || !email || !dni) {
      setErrorMsg("Nombre, apellido, email y DNI son obligatorios.");
      return;
    }
    if (!emailPattern.test(email)) {
      setErrorMsg("Ingresa un correo válido.");
      return;
    }

    const displayName = normalizeName(firstName, lastName);
    const emailLower = email.toLowerCase();

    setSaving(true);
    setErrorMsg(null);

    try {
      if (!db) {
        if (form.id) {
          updateDemoUser(form.id, { displayName, email, role: form.role });
        } else {
          createDemoUser({ displayName, email, role: form.role });
        }
        setRows(mapDemoUsers());
      } else if (form.id) {
        await updateDoc(doc(db!, BARBERS_COLLECTION, form.id), {
          firstName,
          lastName,
          displayName,
          email,
          emailLower,
          dni,
          role: form.role,
        });
        setRows((prev) =>
          prev.map((row) =>
            row.id === form.id
              ? { ...row, firstName, lastName, displayName, email, emailLower, dni, role: form.role }
              : row,
          ),
        );
      } else {
        if (password.length < 6) {
          setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
          setSaving(false);
          return;
        }

        const result = await registrarBarbero({
          displayName,
          email,
          password,
        });

        if (!result.success || !result.uid) {
          throw new Error(result.message || "No pudimos registrar el barbero.");
        }

        await updateDoc(doc(db!, BARBERS_COLLECTION, result.uid), {
          firstName,
          lastName,
          email,
          emailLower,
          dni,
          role: form.role,
        });

        setRows((prev) => [
          { id: result.uid, firstName, lastName, displayName, email, emailLower, dni, role: form.role },
          ...prev,
        ]);
      }
      setShowForm(false);
      setForm(emptyForm);
    } catch (error) {
      console.error("No pudimos guardar el usuario", error);
      const message = error instanceof Error ? error.message : "No pudimos guardar el usuario.";
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (id: string, newRole: Role) => {
    if (!db) {
      updateDemoUser(id, { role: newRole });
      setRows(mapDemoUsers());
      return;
    }
    await updateDoc(doc(db!, BARBERS_COLLECTION, id), { role: newRole });
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, role: newRole } : row)));
  };

  const removeUser = async (id: string) => {
    if (!window.confirm("Seguro que deseas eliminar este barbero?")) return;

    try {
      if (!db) {
        deleteDemoUser(id);
        setRows(mapDemoUsers());
      } else {
        await deleteDoc(doc(db!, BARBERS_COLLECTION, id));
        setRows((prev) => prev.filter((row) => row.id !== id));
      }
    } catch (error) {
      console.error("No pudimos eliminar el usuario", error);
      setErrorMsg("No pudimos eliminar el usuario.");
    }
  };

  if (loading) {
    return <div className="panel text-[var(--ink)]">Cargando usuarios…</div>;
  }

  if (role !== "admin") {
    return <div className="panel text-[var(--ink)]">No tienes permisos para ver esta página.</div>;
  }

  return (
    <div className="panel space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.5em] text-[var(--ink-soft)]">Equipo</span>
          <h1 className="text-3xl font-semibold text-[var(--ink)]">Gestión de barberos</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Crea cuentas nuevas, asigna roles y mantén la información de tu staff al día.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openForm()}>
          Nuevo barbero
        </button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="searchbar"
          placeholder="Buscar por nombre, correo o DNI"
          value={qText}
          onChange={(event) => setQText(event.target.value)}
        />
      </div>

      {showForm && (
        <form className="grid gap-4 bg-[var(--cream-strong)] border border-[var(--border-soft)] rounded-2xl p-5" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-5">
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Nombre</label>
              <input
                className="input mt-1"
                placeholder="Ej. Ana"
                value={form.firstName}
                onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Apellido</label>
              <input
                className="input mt-1"
                placeholder="Ej. Gómez"
                value={form.lastName}
                onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">DNI</label>
              <input
                className="input mt-1"
                placeholder="Ej. 12345678"
                value={form.dni}
                onChange={(event) => setForm((prev) => ({ ...prev, dni: event.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Correo</label>
              <input
                className="input mt-1"
                placeholder="correo@dominio.com"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                type="email"
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

          {!form.id && (
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">Contraseña temporal</label>
              <input
                className="input mt-1"
                placeholder="Mínimo 6 caracteres"
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                required
                minLength={6}
              />
            </div>
          )}

          {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary w-full sm:w-auto" type="submit" disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Actualizar" : "Agregar"}
            </button>
            <button className="btn btn-ghost w-full sm:w-auto" type="button" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="responsive-table text-sm text-[var(--ink)]">
          <thead>
            <tr className="text-left text-[var(--ink-soft)]">
              <th className="py-2 pr-3 font-semibold">Nombre completo</th>
              <th className="py-2 pr-3 font-semibold">DNI</th>
              <th className="py-2 pr-3 font-semibold">Email</th>
              <th className="py-2 pr-3 font-semibold">Rol</th>
              <th className="py-2 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(44,21,10,0.08)]">
            {filtered.map((userRow) => (
              <tr key={userRow.id} className="bg-[rgba(244,237,225,0.85)]">
                <td className="py-3 pr-3 font-medium" data-label="Nombre completo">
                  {userRow.displayName || normalizeName(userRow.firstName, userRow.lastName) || "-"}
                </td>
                <td className="py-3 pr-3" data-label="DNI">
                  {userRow.dni || "-"}
                </td>
                <td className="py-3 pr-3" data-label="Email">
                  {userRow.email || "-"}
                </td>
                <td className="py-3 pr-3 uppercase tracking-[0.25em] text-xs" data-label="Rol">
                  {userRow.role}
                </td>
                <td className="py-3 actions-cell" data-label="Acciones">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full">
                    <select
                      className="input w-full sm:max-w-[130px]"
                      value={userRow.role}
                      onChange={(event) => changeRole(userRow.id, event.target.value as Role)}
                    >
                      <option value="barbero">barbero</option>
                      <option value="admin">admin</option>
                    </select>
                    <button className="btn btn-ghost w-full sm:w-auto" type="button" onClick={() => openForm(userRow)}>
                      Editar
                    </button>
                    <button
                      className="w-full sm:w-auto rounded-full px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                      onClick={() => void removeUser(userRow.id)}
                      disabled={userRow.role === "admin"}
                    >
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
        Las cuentas creadas desde este panel generan usuario en Firebase Auth y perfil en Firestore automáticamente.
      </p>
    </div>
  );
}
