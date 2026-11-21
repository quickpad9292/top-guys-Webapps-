import { createClient } from "@/lib/supabase/client";

const MAX_DIMENSION = 2000; // px on the longest side — sharp on retina phones, small to download
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Phone photos are often 4000px+ and several MB. Downscale large still images in the browser
 * (respecting EXIF orientation) before uploading, so notes load fast on mobile data.
 * GIFs (may be animated) and small images are uploaded untouched.
 */
async function shrinkImage(file: File): Promise<File> {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // format the browser can't decode (e.g. some HEIC) — let the server validate it
  }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const keepAlpha = file.type === "image/png" || file.type === "image/webp";
  const type = keepAlpha ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  if (!blob || blob.size >= file.size) return file;
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${type === "image/webp" ? "webp" : "jpg"}`, { type });
}

export async function uploadImage(original: File, userId: string, noteId: string): Promise<string> {
  if (!original.type.startsWith("image/")) throw new Error("Only images can be uploaded");
  const file = await shrinkImage(original);
  if (file.size > MAX_BYTES) throw new Error("Images must be under 10 MB");
  const ext = (file.name.split(".").pop() || file.type.split("/")[1] || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${noteId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("note-images")
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from("note-images").getPublicUrl(path).data.publicUrl;
}
