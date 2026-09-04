"use client";

import { useMemo, useState } from "react";
import { UserMinus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { personName } from "@/lib/names";
import { formatUnitMark, parseTitleKind } from "@/lib/media";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";
import { memberCanAccessBook } from "@/lib/types";
import type { Book } from "@/lib/types";

export function TitlePeoplePanel({ book }: { book: Book }) {
  const profile = useSessionStore((s) => s.profile)!;
  const room = useSessionStore((s) => s.room)!;
  const members = useSessionStore((s) => s.members);
  const progress = useSessionStore((s) => s.progress);
  const removeFromTitle = useSessionStore((s) => s.removeFromTitle);
  const [kickId, setKickId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = useMemo(() => {
    const me = members.find((m) => m.userId === profile.id);
    return me?.role === "owner" || room.ownerId === profile.id || book.createdBy === profile.id;
  }, [members, profile.id, room.ownerId, book.createdBy]);

  const people = useMemo(
    () => members.filter((m) => memberCanAccessBook(m, book.id)),
    [members, book.id],
  );

  const kickTarget = people.find((m) => m.userId === kickId);
  const kind = parseTitleKind(book.kind);

  return (
    <section className="glass rounded-3xl p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">People on this title</p>
        <p className="text-[11px] text-muted">{people.length}</p>
      </div>
      <ul className="space-y-2">
        {people.map((m) => {
          const name = personName(m.profile);
          const mine = m.userId === profile.id;
          const page =
            progress.find((p) => p.bookId === book.id && p.userId === m.userId)?.currentPage ?? 0;
          const canRemove = canManage && !mine && m.role !== "owner" && m.userId !== room.ownerId;
          return (
            <li key={m.userId} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar name={name} hue={m.profile?.avatarHue ?? 220} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm" dir="auto">
                    {name}
                    {mine ? " (you)" : ""}
                  </p>
                  <p className="text-[11px] text-muted">
                    {m.role === "owner" ? "owner" : m.shelfScope === "books" ? "this title" : "whole shelf"}
                    {` · ${formatUnitMark(kind, page)}`}
                  </p>
                </div>
              </div>
              {canRemove ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-accent"
                  aria-label={`Remove ${name} from this title`}
                  onClick={() => setKickId(m.userId)}
                >
                  <UserMinus size={16} />
                  Remove
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {people.length <= 1 ? (
        <p className="text-[11px] text-muted">
          Share this title. After they open the link, they show up here.
        </p>
      ) : canManage ? (
        <p className="text-[11px] text-muted">
          Remove takes them off this book, course, movie, or series — not your other titles.
        </p>
      ) : null}

      <Modal open={Boolean(kickId)} onClose={() => !busy && setKickId(null)} title="Remove from this title?">
        <p className="text-sm text-muted">
          {personName(kickTarget?.profile, "This person")} loses this title. They keep any other
          books you still share. If this was their only title, they leave the room.
        </p>
        <div className="mt-5 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={busy}
            onClick={() => setKickId(null)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={busy}
            onClick={() => {
              if (!kickId) return;
              setBusy(true);
              void removeFromTitle(book.id, kickId)
                .then(() => {
                  useToastStore.getState().push({
                    title: "Removed",
                    body: `${personName(kickTarget?.profile, "They")} no longer have this title.`,
                    tone: "success",
                  });
                  setKickId(null);
                })
                .catch((err) => {
                  useToastStore.getState().push({
                    title: "Couldn’t remove",
                    body: err instanceof Error ? err.message : "Try again",
                    tone: "warn",
                  });
                })
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Removing…" : "Remove"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
