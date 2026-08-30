"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToastStore } from "@/lib/store/toast-store";

export function ShareLinkModal({
  open,
  onClose,
  title,
  url,
  warning,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
  warning?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      useToastStore.getState().push({ title: "Link copied", tone: "success" });
    } catch {
      useToastStore.getState().push({
        title: "Select and copy the link",
        body: "Clipboard isn’t available in this browser context.",
        tone: "warn",
      });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {warning ? <p className="mb-3 text-sm text-accent">{warning}</p> : null}
      <p className="mb-2 text-xs text-muted">Tap the link to select it, then copy if needed.</p>
      <textarea
        readOnly
        value={url}
        rows={3}
        className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-cream"
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Close
        </Button>
        <Button className="flex-1" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </Modal>
  );
}
