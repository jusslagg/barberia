import { useEffect, useMemo, useRef, useState } from "react";

export interface CarouselItem {
  id: string;
  url: string;
  alt?: string;
  caption?: string;
}

interface Props {
  items: CarouselItem[];
  /** Tiempo entre cada cambio automatico en milisegundos. */
  intervalMs?: number;
  /** Duracion de la transicion de opacidad en milisegundos. */
  transitionMs?: number;
}

const DEFAULT_INTERVAL = 5000;
const DEFAULT_TRANSITION = 1300;

export default function AutoCarousel({ items, intervalMs = DEFAULT_INTERVAL, transitionMs = DEFAULT_TRANSITION }: Props) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<number | null>(null);

  const sanitizedItems = useMemo(() => items.filter((item) => Boolean(item?.url)), [items]);
  const total = sanitizedItems.length;

  useEffect(() => {
    setActive((prev) => {
      if (total === 0) return 0;
      if (prev >= total) return 0;
      return prev;
    });
  }, [total]);

  useEffect(() => {
    if (total <= 1) return;
    if (timerRef.current) window.clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      setActive((prev) => (prev + 1) % total);
    }, Math.max(intervalMs, transitionMs));

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [total, intervalMs, transitionMs]);

  if (!total) {
    return (
      <div className="auto-carousel-placeholder">
        <span>No hay imágenes disponibles aún.</span>
      </div>
    );
  }

  return (
    <div className="auto-carousel-container">
      {sanitizedItems.map((item, index) => {
        const isActive = index === active;
        return (
          <div
            key={item.id}
            className="auto-carousel-slide"
            data-active={isActive ? "true" : "false"}
            style={{ transition: `opacity ${transitionMs}ms ease-in-out` }}
          >
            <img src={item.url} alt={item.alt || item.caption || "Foto de cliente"} />
            {item.caption ? <div className="auto-carousel-caption">{item.caption}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
