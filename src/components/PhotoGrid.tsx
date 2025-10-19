export type PhotoItem = {
  id?: string;
  url: string;
  deleteToken?: string | null;
  barberId?: string;
};

interface Props {
  photos: PhotoItem[];
  onDelete?: (photo: PhotoItem) => void;
  canDelete?: boolean;
}

export default function PhotoGrid({ photos, onDelete, canDelete }: Props) {
  if (!photos?.length) {
    return <div className="text-[var(--ink-soft)] text-sm">Aun no hay fotos para este cliente.</div>;
  }

  const allowDelete = canDelete && typeof onDelete === "function";

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {photos.map((photo, index) => {
        const key = photo.id || `${photo.url}-${index}`;
        return (
          <div key={key} className="relative rounded-xl shadow-lg overflow-hidden">
            <img src={photo.url} className="aspect-square w-full object-cover" />
            {allowDelete && (
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-black/90"
                onClick={() => onDelete(photo)}
              >
                Borrar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
