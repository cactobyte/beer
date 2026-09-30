import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getUser()) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-center">
        <span className="font-display text-5xl font-extrabold tracking-tight text-foam">sesh</span>
        <span className="mt-1 block text-sm text-muted">the drinks leaderboard</span>
      </Link>
      {children}
    </main>
  );
}
