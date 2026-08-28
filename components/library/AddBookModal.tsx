"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { coverUrlFromDoc, searchOpenLibrary } from "@/lib/openlibrary";
import type { BookStatus, OpenLibraryDoc } from "@/lib/types";
import { useSessionStore } from "@/lib/store/session-store";

export function AddBookModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addBook = useSessionStore((s) => s.addBook);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpenLibraryDoc[]>([]);
  const [searching, setSearching] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("320");
  const [cover, setCover] = useState("");
  const [status, setStatus] = useState<BookStatus>("currently_reading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchOpenLibrary(q));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 320);
    return () => window.clearTimeout(t);
  }, [query]);

  function pick(doc: OpenLibraryDoc) {
    setTitle(doc.title);
    setAuthor(doc.author_name?.[0] ?? "");
    setPages(String(doc.number_of_pages_median ?? 300));
    setCover(coverUrlFromDoc(doc) ?? "");
    setQuery("");
    setResults([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addBook({
        title: title.trim(),
        author: author.trim() || "Unknown",
        totalPages: Math.max(1, Number(pages) || 1),
        coverUrl: cover.trim() || null,
        status,
      });
      setTitle("");
      setAuthor("");
      setCover("");
      setPages("320");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a book">
      <label className="relative block">
        <Search size={16} className="absolute top-4 left-3 text-muted" />
        <Input
          className="pl-9"
          dir="auto"
          placeholder="Search Open Library…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {searching ? <p className="mt-2 text-xs text-muted">Searching…</p> : null}
      {results.length > 0 ? (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {results.map((doc) => (
            <li key={doc.key}>
              <button
                type="button"
                onClick={() => pick(doc)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrlFromDoc(doc, "S") ?? "/icons/icon-192.png"}
                  alt=""
                  className="h-12 w-8 rounded object-cover"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-cream" dir="auto">
                    {doc.title}
                  </span>
                  <span className="block truncate text-xs text-muted" dir="auto">
                    {doc.author_name?.[0]}
                    {doc.number_of_pages_median ? ` · ${doc.number_of_pages_median}p` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={submit} className="mt-4 space-y-3">
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
        <div className="flex gap-2 text-xs">
          {(
            [
              ["currently_reading", "Reading"],
              ["want_to_read", "Want to read"],
              ["completed", "Completed"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`flex-1 rounded-xl py-2 ${
                status === value ? "bg-brand text-white" : "bg-white/5 text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button type="submit" className="w-full" disabled={busy || !title.trim()}>
          {busy ? "Adding…" : "Add to library"}
        </Button>
      </form>
    </Modal>
  );
}
