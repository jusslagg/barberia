export type Role = "admin" | "barbero";

export type UserDoc = { role: Role; displayName: string; email: string };

export const NOTE_OPTIONS = ["corte", "alisado", "lavado", "planchado", "otros"] as const;
export type NoteOption = (typeof NOTE_OPTIONS)[number];
export type ClientNotes = NoteOption[];

export type Client = {
  id: string;
  fullName: string;
  fullName_lower?: string;
  phone?: string;
  mainBarberId: string;
  notes?: ClientNotes;
  createdAt: any;
};

export type Cut = {
  id: string;
  clientId: string;
  barberId: string;
  photos: string[];
  style?: string;
  notes?: string;
  createdAt: any;
};
