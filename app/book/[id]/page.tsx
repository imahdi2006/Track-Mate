import { AppShell } from "@/components/layout/AppShell";
import { BookDetailScreen } from "@/components/book/BookDetailScreen";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <BookDetailScreen bookId={id} />
    </AppShell>
  );
}
