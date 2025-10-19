import { useCallback, useEffect, useMemo, useState } from "react";
import type { PhotoItem } from "./PhotoGrid";

interface Props {
  photos: PhotoItem[];
  initialIndex: number;
  onClose: () => void;
}

const clampIndex = (value: number, length: number) => {
  if (!Number.isFinite(value) || length <= 0) return 0;
  const maxIndex = length - 1;
  if (value < 0) return 0;
  if (value > maxIndex) return maxIndex;
  return value;
};

export default function PhotoLightbox({ photos, initialIndex, onClose }: Props) {
  const total = photos.length;
  const [activeIndex, setActiveIndex] = useState(() => clampIndex(initialIndex, total));

  useEffect(() => {
    setActiveIndex(clampIndex(initialIndex, total));
  }, [initialIndex, total]);

  useEffect(() => {
    if (!total) {
      onClose();
    }
  }, [total, onClose]);

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    const { overflow, paddingRight } = document.body.style;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, []);

  const currentPhoto = useMemo(() => photos[activeIndex], [photos, activeIndex]);

  if (!total || !currentPhoto) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex bg-black/90 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative mx-auto flex max-w-4xl grow items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={currentPhoto.url}
          alt="Foto del cliente"
          className="max-h-[80vh] w-auto max-w-full rounded-2xl shadow-2xl"
        />

        {total > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-lg text-white transition hover:bg-white/40"
              onClick={goPrev}
              aria-label="Foto anterior"
            >
              {"<"}
            </button>
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-lg text-white transition hover:bg-white/40"
              onClick={goNext}
              aria-label="Foto siguiente"
            >
              {">"}
            </button>
          </>
        ) : null}

        <button
          type="button"
          className="absolute right-4 top-4 rounded-full bg-white/20 px-2 py-1 text-sm text-white transition hover:bg-white/40"
          onClick={onClose}
          aria-label="Cerrar galeria"
        >
          X
        </button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
          {activeIndex + 1} / {total}
        </div>
      </div>
    </div>
  );
}
