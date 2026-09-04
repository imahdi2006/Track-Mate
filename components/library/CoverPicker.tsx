"use client";

import { useRef, useState } from "react";
import { Crop, ImagePlus, Trash2 } from "lucide-react";
import { CoverCropModal } from "@/components/library/CoverCropModal";
import { persistCoverBlob, isUsableCoverUrl, loadImageForCrop } from "@/lib/covers";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";

export function CoverPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const cropRevoke = useRef<(() => void) | null>(null);
  const preview = isUsableCoverUrl(value) ? value : "";

  function releaseCrop() {
    cropRevoke.current?.();
    cropRevoke.current = null;
  }

  async function openCrop(src: string, fromFile = false) {
    releaseCrop();
    setBusy(true);
    try {
      if (fromFile) {
        setCropSrc(src);
        cropRevoke.current = () => URL.revokeObjectURL(src);
        return;
      }
      const loaded = await loadImageForCrop(src);
      setCropSrc(loaded.url);
      cropRevoke.current = loaded.revoke;
    } catch (err) {
      useToastStore.getState().push({
        title: "Couldn’t open crop",
        body: err instanceof Error ? err.message : "Try a photo from your device.",
        tone: "warn",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      useToastStore.getState().push({
        title: "Choose an image",
        body: "JPG, PNG, or WebP works.",
        tone: "warn",
      });
      return;
    }
    await openCrop(URL.createObjectURL(file), true);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function finishCrop(blob: Blob) {
    setBusy(true);
    try {
      const url = await persistCoverBlob(blob);
      onChange(url);
      setCropSrc(null);
      releaseCrop();
    } catch (err) {
      useToastStore.getState().push({
        title: "Couldn’t use that photo",
        body: err instanceof Error ? err.message : "Try another image.",
        tone: "warn",
      });
    } finally {
      setBusy(false);
    }
  }

  async function recropPreview() {
    if (!preview) return;
    await openCrop(preview);
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-stretch gap-3 rounded-2xl p-2 ring-1 ring-white/10 transition",
          dragging ? "bg-brand/15 ring-brand-glow" : "bg-white/4",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFile(e.dataTransfer.files?.[0]);
        }}
      >
        <button
          type="button"
          onClick={() => (preview ? void recropPreview() : inputRef.current?.click())}
          className="relative h-36 w-24 shrink-0 overflow-hidden rounded-2xl bg-canvas/60 ring-1 ring-white/10"
          aria-label={preview ? "Crop cover" : "Add cover"}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-1 text-muted">
              <ImagePlus size={22} />
              <span className="text-[10px]">2:3 cover</span>
            </span>
          )}
          {preview ? (
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[10px] text-cream">
              Crop
            </span>
          ) : null}
        </button>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus size={16} />
            {busy ? "Working…" : preview ? "Change photo" : "Choose photo"}
          </Button>
          {preview ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                disabled={busy}
                onClick={() => void recropPreview()}
              >
                <Crop size={14} />
                Crop
              </Button>
              <button
                type="button"
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs text-muted hover:bg-white/5 hover:text-accent"
                onClick={() => onChange("")}
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          ) : (
            <p className="text-[11px] leading-snug text-muted">
              Drop a photo. You’ll crop it to a cover before it saves.
            </p>
          )}
        </div>
      </div>
      {showUrl || !compact ? (
        <Input
          placeholder="Or paste a cover image URL"
          value={value.startsWith("data:") ? "" : value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <button
          type="button"
          className="text-[11px] text-muted hover:text-cream"
          onClick={() => setShowUrl(true)}
        >
          Paste a cover URL instead
        </button>
      )}
      <CoverCropModal
        open={Boolean(cropSrc)}
        src={cropSrc}
        onCancel={() => {
          setCropSrc(null);
          releaseCrop();
        }}
        onCrop={(blob) => void finishCrop(blob)}
      />
    </div>
  );
}
