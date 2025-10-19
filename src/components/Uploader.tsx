import { useState, type ChangeEvent } from "react";
import { uploadImage, type UploadedAsset } from "../lib/uploadCloudinary";

interface Props {
  onUploaded: (asset: UploadedAsset) => void;
  folder?: string;
  disabled?: boolean;
}

export default function Uploader({ onUploaded, folder, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setErrorMsg(null);

    try {
      const asset = await uploadImage(file, {
        folder,
        onProgress: (percent) => setProgress(percent),
      });
      onUploaded(asset);
    } catch (error) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : "No pudimos subir la imagen.");
    } finally {
      input.value = "";
      setUploading(false);
      setProgress(0);
    }
  };

  const isDisabled = disabled || uploading;
  const labelText = uploading ? `Subiendo...${progress > 0 ? ` ${progress}%` : ""}` : "Subir imagen";

  return (
    <div className="space-y-1">
      <label className={`uploader-trigger${isDisabled ? " disabled" : ""}`}>
        <input type="file" accept="image/*" hidden disabled={isDisabled} onChange={handleUpload} />
        <span>{labelText}</span>
      </label>
      {errorMsg && <p className="text-xs text-red-500 text-right">{errorMsg}</p>}
    </div>
  );
}
