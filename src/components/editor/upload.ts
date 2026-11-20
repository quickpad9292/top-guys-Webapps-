import { createClient } from "@/lib/supabase/client";

export async function uploadImage(file: File, userId: string, noteId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be uploaded");
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be under 10 MB");
  const ext = (file.name.split(".").pop() || file.type.split("/")[1] || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${noteId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("note-images")
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from("note-images").getPublicUrl(path).data.publicUrl;
}
