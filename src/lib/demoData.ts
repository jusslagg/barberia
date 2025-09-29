
import type { Client, Role } from "../types";

const isoNow = () => new Date().toISOString();

const initialClients: Client[] = [
  {
    id: "carlos-ruiz",
    fullName: "Carlos Ruiz",
    phone: "555 0101",
    mainBarberId: "demo-barber",
    notes: "Fade bajo con linea marcada. Usa pomada mate.",
    createdAt: isoNow(),
  },
  {
    id: "maria-garcia",
    fullName: "Maria Garcia",
    phone: "555 0123",
    mainBarberId: "demo-barber",
    notes: "Corte bob texturizado. Prefiere styling natural.",
    createdAt: isoNow(),
  },
  {
    id: "leo-suarez",
    fullName: "Leo Suarez",
    phone: "555 0145",
    mainBarberId: "demo-barber",
    notes: "Cliente nuevo. Probar mid fade la proxima visita.",
    createdAt: isoNow(),
  },
];

let clientsStore: Client[] = [...initialClients];

const initialPhotos: Record<string, string[]> = {
  "carlos-ruiz": [
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80",
  ],
  "maria-garcia": [
    "https://images.unsplash.com/photo-1492725764893-90b379c2b6e7?auto=format&fit=crop&w=500&q=80",
  ],
  "leo-suarez": [],
};

let photosStore: Record<string, string[]> = { ...initialPhotos };

export type DemoUser = { id: string; displayName: string; email: string; role: Role };

const initialUsers: DemoUser[] = [
  { id: "demo-barber", displayName: "Alex Demo", email: "demo@barberia.dev", role: "admin" },
  { id: "marcela", displayName: "Marcela", email: "marcela@barberia.dev", role: "barbero" },
  { id: "diego", displayName: "Diego", email: "diego@barberia.dev", role: "barbero" },
];

let usersStore: DemoUser[] = [...initialUsers];
const defaultOwnerId = initialUsers[0]?.id ?? "demo-barber";

export function listDemoClients() {
  return [...clientsStore];
}

export function getDemoClient(id: string) {
  return clientsStore.find((c) => c.id === id) || null;
}

export function createDemoClient(data: { fullName: string; phone?: string; mainBarberId?: string; notes?: string }) {
  const newClient: Client = {
    id: `demo-client-${Date.now()}`,
    fullName: data.fullName,
    phone: data.phone,
    mainBarberId: data.mainBarberId || defaultOwnerId,
    notes: data.notes || "",
    createdAt: isoNow(),
  };
  clientsStore = [newClient, ...clientsStore];
  return newClient;
}

export function updateDemoClient(id: string, patch: Partial<Client>) {
  clientsStore = clientsStore.map((c) => (c.id === id ? { ...c, ...patch } : c));
  return getDemoClient(id);
}

export function deleteDemoClient(id: string) {
  clientsStore = clientsStore.filter((c) => c.id !== id);
  delete photosStore[id];
}

export function listDemoPhotos(clientId: string) {
  return [...(photosStore[clientId] || [])];
}

export function pushDemoPhoto(clientId: string, url: string) {
  const current = photosStore[clientId] || [];
  photosStore[clientId] = [url, ...current];
  return photosStore[clientId];
}

export function listDemoUsers() {
  return [...usersStore];
}

export function createDemoUser(data: { displayName: string; email: string; role?: Role }) {
  const newUser: DemoUser = {
    id: `demo-user-${Date.now()}`,
    displayName: data.displayName,
    email: data.email,
    role: data.role || "barbero",
  };
  usersStore = [newUser, ...usersStore];
  return newUser;
}

export function updateDemoUser(id: string, patch: Partial<DemoUser>) {
  usersStore = usersStore.map((u) => (u.id === id ? { ...u, ...patch } : u));
  return usersStore.find((u) => u.id === id) || null;
}

export function deleteDemoUser(id: string) {
  usersStore = usersStore.filter((u) => u.id !== id);
}
