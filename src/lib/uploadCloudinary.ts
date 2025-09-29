import axios from "axios";

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(cloudName && uploadPreset);

export async function uploadImage(file: File, folder: string) {
  if (!isCloudinaryConfigured) {
    const prettyName = encodeURIComponent(file.name || "demo");
    await new Promise((resolve) => setTimeout(resolve, 350));
    return `https://placehold.co/600x600?text=${prettyName}`;
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", uploadPreset);
  form.append("folder", folder);
  const { data } = await axios.post(url, form);
  return data.secure_url as string;
}
