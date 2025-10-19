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
  onSelect?: (photo: PhotoItem, index: number) => void;
}

export default function PhotoGrid({ photos, onDelete, canDelete, onSelect }: Props) {
  if (!photos?.length) {
    return <div className="text-[var(--ink-soft)] text-sm">Aun no hay fotos para este cliente.</div>;
  }

  const allowDelete = canDelete && typeof onDelete === "function";

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {photos.map((photo, index) => {
        const key = photo.id || `${photo.url}-${index}`;
        return (
          <div
            key={key}
            className={`relative overflow-hidden rounded-xl shadow-lg ${onSelect ? "cursor-zoom-in" : ""}`}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={() => onSelect?.(photo, index)}
            onKeyDown={(event) => {
              if (!onSelect) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(photo, index);
              }
            }}
          >
            <img src={photo.url} className="aspect-square w-full object-cover" />
            {allowDelete && (
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-black/90"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete?.(photo);
                }}
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
