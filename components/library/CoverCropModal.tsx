"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cropImageToCover } from "@/lib/covers";
import { useToastStore } from "@/lib/store/toast-store";

const VIEW_W = 240;
const VIEW_H = 360;

export function CoverCropModal({
  open,
  src,
  onCancel,
  onCrop,
}: {
  open: boolean;
  src: string | null;
  onCancel: () => void;
  onCrop: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  function minZoomFor(w: number, h: number) {
    if (!w || !h) return 1;
    return Math.max(VIEW_W / w, VIEW_H / h);
  }

  function clampOffset(next: { x: number; y: number }, z: number, w = nat.w, h = nat.h) {
    if (!w || !h) return next;
    const dw = w * z;
    const dh = h * z;
    return {
      x: Math.min(0, Math.max(VIEW_W - dw, next.x)),
      y: Math.min(0, Math.max(VIEW_H - dh, next.y)),
    };
  }

  useEffect(() => {
    if (!open) {
      setReady(false);
      setNat({ w: 0, h: 0 });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [open, src]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const minZ = minZoomFor(nat.w, nat.h);
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      const z = Math.min(minZ * 3, Math.max(minZ, zoom * factor));
      setZoom(z);
      setOffset((o) => clampOffset(o, z));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, nat.w, nat.h, zoom]);

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const z = minZoomFor(w, h);
    setNat({ w, h });
    setZoom(z);
    setOffset(
      clampOffset(
        {
          x: (VIEW_W - w * z) / 2,
          y: (VIEW_H - h * z) / 2,
        },
        z,
        w,
        h,
      ),
    );
    setReady(true);
  }

  async function apply() {
    const img = imgRef.current;
    if (!img || !ready) return;
    const size = VIEW_W / zoom;
    const x = -offset.x / zoom;
    const y = -offset.y / zoom;
    try {
      const blob = await cropImageToCover(img, { x, y, size });
      onCrop(blob);
    } catch {
      useToastStore.getState().push({
        title: "Couldn’t crop that photo",
        body: "Try another image, or choose a file from your device.",
        tone: "warn",
      });
    }
  }

  const minZ = minZoomFor(nat.w, nat.h);

  return (
    <Modal open={open} onClose={onCancel} title="Crop cover">
      <p className="mb-3 text-sm text-muted">
        Drag to frame it. Use the slider (or scroll) to zoom. Saved as a 2:3 cover.
      </p>
      <div
        ref={frameRef}
        className="relative mx-auto overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/15"
        style={{ width: VIEW_W, height: VIEW_H, touchAction: "none" }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setOffset(
            clampOffset(
              {
                x: drag.current.ox + (e.clientX - drag.current.x),
                y: drag.current.oy + (e.clientY - drag.current.y),
              },
              zoom,
            ),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={onImgLoad}
            className="absolute left-0 top-0 max-w-none select-none"
            style={{
              width: nat.w ? nat.w * zoom : undefined,
              height: nat.h ? nat.h * zoom : undefined,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-1/3 border-t border-white/25" />
          <div className="absolute inset-x-0 top-2/3 border-t border-white/25" />
          <div className="absolute inset-y-0 left-1/3 border-l border-white/25" />
          <div className="absolute inset-y-0 left-2/3 border-l border-white/25" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/40" />
        </div>
      </div>
      <label className="mt-4 block text-xs text-muted">
        Zoom
        <input
          type="range"
          min={minZ}
          max={Math.max(minZ * 3, minZ + 0.2)}
          step={0.01}
          value={zoom}
          className="mt-1 w-full"
          onChange={(e) => {
            const z = Number(e.target.value);
            setZoom(z);
            setOffset((o) => clampOffset(o, z));
          }}
        />
      </label>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={!ready} onClick={() => void apply()}>
          Use this crop
        </Button>
      </div>
    </Modal>
  );
}
