import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl">🫗</p>
      <h1 className="font-display text-2xl font-extrabold">Nothing here</h1>
      <p className="text-sm text-muted">Either it doesn’t exist or you’re not in that group.</p>
      <Link href="/" className="btn btn-primary">
        Home
      </Link>
    </main>
  );
}
