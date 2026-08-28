"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { isUsableCoverUrl } from "@/lib/covers";
import type { Book } from "@/lib/types";
import { useSessionStore } from "@/lib/store/session-store";

export function EditBookModal({
  book,
  open,
  onClose,
}: {
  book: Book;
  open: boolean;
  onClose: () => void;
}) {
  const updateBook = useSessionStore((s) => s.updateBook);
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [pages, setPages] = useState(String(book.totalPages));
  const [cover, setCover] = useState(isUsableCoverUrl(book.coverUrl) ? book.coverUrl! : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(book.title);
    setAuthor(book.author);
    setPages(String(book.totalPages));
    setCover(isUsableCoverUrl(book.coverUrl) ? book.coverUrl! : "");
  }, [open, book]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await updateBook(book.id, {
        title: title.trim(),
        author: author.trim() || "Unknown",
        totalPages: Math.max(1, Number(pages) || book.totalPages),
        coverUrl: cover.trim() || null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit book">
      <form onSubmit={submit} className="space-y-3">
        <Input dir="auto" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input dir="auto" placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <Input
          placeholder="Total pages"
          inputMode="numeric"
          value={pages}
          onChange={(e) => setPages(e.target.value)}
        />
        <Input
          placeholder="Cover image URL (optional)"
          value={cover}
          onChange={(e) => setCover(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={busy || !title.trim()}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
}
