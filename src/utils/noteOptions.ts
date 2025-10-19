import { NOTE_OPTIONS, type NoteOption } from "../types";

export const NOTE_LABELS: Record<NoteOption, string> = {
  corte: "Corte",
  alisado: "Alisado",
  lavado: "Lavado",
  planchado: "Planchado",
  otros: "Otros",
};

export const toNoteOption = (value: unknown): NoteOption | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return NOTE_OPTIONS.includes(normalized as NoteOption) ? (normalized as NoteOption) : null;
};

export const toNoteOptionArray = (value: unknown): NoteOption[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    const mapped = value
      .map((item) => toNoteOption(item))
      .filter((item): item is NoteOption => item !== null);
    return Array.from(new Set(mapped));
  }
  if (typeof value === "string") {
    const primaryMatches = value
      .split(/[,;\n]/)
      .map((item) => toNoteOption(item))
      .filter((item): item is NoteOption => item !== null);
    if (primaryMatches.length > 0) {
      return Array.from(new Set(primaryMatches));
    }
    const lowerValue = value.toLowerCase();
    return NOTE_OPTIONS.filter((option) => lowerValue.includes(option));
  }
  return [];
};

export const notesToSearchText = (notes: NoteOption[] | undefined): string =>
  Array.isArray(notes) ? notes.join(" ") : "";
