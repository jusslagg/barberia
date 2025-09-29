export default function PhotoGrid({ photos }: { photos: string[] }) {
  if (!photos?.length) {
    return <div className="text-[var(--ink-soft)] text-sm">Aun no hay fotos para este cliente.</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {photos.map((url, index) => (
        <img key={index} src={url} className="rounded-xl aspect-square object-cover shadow-lg" />
      ))}
    </div>
  );
}
