import axios, { type AxiosProgressEvent } from "axios";

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(cloudName && uploadPreset);

export type UploadedAsset = {
  url: string;
  deleteToken: string | null;
};

type UploadOptions = {
  folder?: string;
  onProgress?: (percent: number) => void;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const calculatePercent = (event: AxiosProgressEvent) => {
  if (!event.total) return 0;
  return Math.round((event.loaded / event.total) * 100);
};

export async function uploadImage(file: File, options: UploadOptions = {}): Promise<UploadedAsset> {
  const { folder = "barberia", onProgress } = options;

  if (!isCloudinaryConfigured) {
    if (import.meta.env.PROD) {
      throw new Error("Cloudinary no configurado: faltan VITE_CLOUDINARY_*");
    }
    const prettyName = encodeURIComponent(file.name || "demo");
    await delay(350);
    onProgress?.(100);
    return { url: `https://placehold.co/600x600?text=${prettyName}`, deleteToken: null };
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName!}/image/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", uploadPreset!);
  if (folder) {
    form.append("folder", folder);
  }

  const shouldRequestDeleteToken = import.meta.env.VITE_CLOUDINARY_ALLOW_DELETE_TOKEN !== "false";

  const performUpload = async (includeDeleteToken: boolean) => {
    const payload = new FormData();
    form.forEach((value, key) => {
      payload.append(key, value);
    });
    if (includeDeleteToken) {
      payload.append("return_delete_token", "1");
    }
    const { data } = await axios.post(url, payload, {
      onUploadProgress: (event) => {
        if (!onProgress) return;
        const percent = calculatePercent(event);
        if (percent > 0) onProgress(percent);
      },
    });
    onProgress?.(100);
    const deleteToken =
      typeof data.delete_token === "string" && data.delete_token.trim().length ? data.delete_token : null;
    return { url: data.secure_url as string, deleteToken };
  };

  try {
    return await performUpload(shouldRequestDeleteToken);
  } catch (error) {
    console.error("No pudimos subir la imagen a Cloudinary", error);
    if (axios.isAxiosError(error)) {
      const cloudMessage =
        typeof error.response?.data?.error?.message === "string"
          ? error.response.data.error.message
          : typeof error.response?.data?.message === "string"
            ? error.response.data.message
            : null;
      if (
        shouldRequestDeleteToken &&
        cloudMessage?.toLowerCase().includes("return delete token parameter is not allowed")
      ) {
        console.warn("Cloudinary rechazo el delete token para uploads sin firma. Reintentando sin ese parametro.");
        try {
          return await performUpload(false);
        } catch (retryError) {
          console.error("El reintento sin delete token tambien fallo", retryError);
          throw new Error(
            cloudMessage
              ? `Cloudinary rechazo la imagen: ${cloudMessage}`
              : "No pudimos subir la imagen. Intenta de nuevo.",
          );
        }
      }
      throw new Error(
        cloudMessage ? `Cloudinary rechazo la imagen: ${cloudMessage}` : "No pudimos subir la imagen. Intenta de nuevo.",
      );
    }
    throw new Error("No pudimos subir la imagen. Intenta de nuevo.");
  }
}

export async function deleteImageByToken(token: string) {
  if (!token) {
    throw new Error("Token de eliminacion invalido.");
  }

  if (!isCloudinaryConfigured) {
    if (import.meta.env.PROD) {
      throw new Error("Cloudinary no configurado: faltan VITE_CLOUDINARY_*");
    }
    // Modo demo: nada que eliminar realmente.
    return;
  }

  try {
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName!}/delete_by_token`;
    const form = new FormData();
    form.append("token", token);
    await axios.post(endpoint, form);
  } catch (error) {
    console.error("No pudimos eliminar la imagen en Cloudinary", error);
    throw new Error("No pudimos eliminar la imagen. Intenta de nuevo.");
  }
}
