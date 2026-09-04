const PLACEHOLDER_SNIPPETS = [
  "/icons/icon",
  "icon-192",
  "icon-512",
  "apple-touch-icon",
];

export function isUsableCoverUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  if (!value) return false;
  return !PLACEHOLDER_SNIPPETS.some((snip) => value.includes(snip));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn’t read that image."));
    reader.readAsDataURL(blob);
  });
}

export async function compressCoverFile(file: File, maxEdge = 720): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn’t process that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Couldn’t save that image."));
        else resolve(blob);
      },
      "image/jpeg",
      0.82,
    );
  });
}

/** Fetch a remote cover as a blob URL so the crop canvas is not CORS-tainted. */
export async function loadImageForCrop(src: string): Promise<{ url: string; revoke: () => void }> {
  if (src.startsWith("blob:") || src.startsWith("data:")) {
    return { url: src, revoke: () => {} };
  }
  let blob: Blob | null = null;
  try {
    const res = await fetch(src, { mode: "cors" });
    if (res.ok) {
      const next = await res.blob();
      if (next.type.startsWith("image/") || next.size > 0) blob = next;
    }
  } catch {
    blob = null;
  }
  if (!blob || blob.size === 0) {
    const proxied = await fetch(`/api/covers/proxy?url=${encodeURIComponent(src)}`);
    if (!proxied.ok) {
      throw new Error("Couldn’t load that image to crop. Try a photo from your device.");
    }
    blob = await proxied.blob();
  }
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export async function persistCoverBlob(blob: Blob): Promise<string> {
  const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
  const sb = getSupabaseBrowserClient();
  if (sb) {
    const { data: auth } = await sb.auth.getUser();
    const uid = auth.user?.id;
    if (uid) {
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from("covers").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (!error) {
        const { data } = sb.storage.from("covers").getPublicUrl(path);
        if (data.publicUrl) return data.publicUrl;
      }
    }
  }
  return blobToDataUrl(blob);
}

/** Upload to Supabase Storage when configured; otherwise a compressed data URL. */
export async function persistCoverFile(file: File): Promise<string> {
  const blob = await compressCoverFile(file);
  return persistCoverBlob(blob);
}

/** `size` is the source width of a 2:3 cover window in image pixels. */
export async function cropImageToCover(
  source: HTMLImageElement | ImageBitmap,
  frame: { x: number; y: number; size: number },
): Promise<Blob> {
  const outW = 400;
  const outH = 600;
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn’t crop that image.");
  ctx.drawImage(source, frame.x, frame.y, frame.size, frame.size * 1.5, 0, 0, outW, outH);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Couldn’t save the crop."));
        else resolve(blob);
      },
      "image/jpeg",
      0.86,
    );
  });
}

export async function lookupCoverUrl(title: string, author?: string): Promise<string | null> {
  const q = [title, author].map((s) => s?.trim()).filter(Boolean).join(" ");
  if (q.length < 2) return null;
  try {
    const { searchOpenLibrary, coverUrlFromDoc } = await import("@/lib/openlibrary");
    const docs = await searchOpenLibrary(q, 8);
    for (const doc of docs) {
      const url = coverUrlFromDoc(doc, "L");
      if (url) return url;
    }
  } catch {
    return null;
  }
  return null;
}
