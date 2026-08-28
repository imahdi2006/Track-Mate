import { JoinCapture } from "@/components/auth/JoinCapture";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ book?: string }>;
}) {
  const { code } = await params;
  const { book } = await searchParams;
  return <JoinCapture code={code} bookId={book} />;
}
