import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/queries";
import { LAST_GROUP_COOKIE } from "@/lib/constants";

export default async function Home() {
  const user = await getUser();
  if (user) {
    const groups = await getMyGroups(user.id);
    const last = (await cookies()).get(LAST_GROUP_COOKIE)?.value;
    const target = groups.find((g) => g.id === last) ?? groups[0];
    redirect(target ? `/g/${target.id}` : "/groups");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 text-center">
      <h1 className="font-display text-7xl font-extrabold tracking-tight text-foam">sesh</h1>
      <p className="mt-3 text-lg text-muted">Log your drinks. Climb the leaderboard. Regret nothing.</p>
      <div className="mx-auto mt-10 grid w-full max-w-xs gap-3">
        <Link href="/signup" className="btn btn-primary">
          Get started
        </Link>
        <Link href="/login" className="btn btn-ghost">
          Log in
        </Link>
      </div>
      <ul className="mx-auto mt-12 space-y-2 text-left text-sm text-muted">
        <li>🍺 One tap to log a pint, shot or whatever</li>
        <li>🏆 Live leaderboard for tonight, the week, all time</li>
        <li>👯 Private groups — share a code with your mates</li>
      </ul>
      <p className="mt-12 text-xs text-dim">Drink responsibly. This is a joke leaderboard, not a challenge.</p>
    </main>
  );
}
