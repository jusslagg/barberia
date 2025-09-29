import { uploadImage } from "../lib/uploadCloudinary";

interface Props {
  onUploaded: (url: string) => void;
  disabled?: boolean;
}

export default function Uploader({ onUploaded, disabled }: Props) {
  return (
    <label className={`uploader-trigger${disabled ? " disabled" : ""}`}>
      <input
        type="file"
        accept="image/*"
        hidden
        disabled={disabled}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const url = await uploadImage(file, "barberia");
          onUploaded(url);
          event.target.value = "";
        }}
      />
      <span>Subir imagen</span>
    </label>
  );
}
