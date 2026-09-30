import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Pages call requireUser() themselves with their own return path; the layout
  // can't know the URL, so it just renders nothing extra when logged out.
  const me = await getUser();
  if (!me) return children;
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="font-display text-3xl font-extrabold tracking-tight text-foam">
          sesh
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/groups" className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink">
            Groups
          </Link>
          <Link href={`/u/${me.username}`} aria-label="Your profile">
            <Avatar emoji={me.emoji} size="sm" />
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
