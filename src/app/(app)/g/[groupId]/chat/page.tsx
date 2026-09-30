import Link from "next/link";
import { Chat } from "@/components/Chat";
import { requireUser } from "@/lib/auth";
import { getMessages, requireGroup } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/g/[groupId]/chat">) {
  const { groupId } = await params;
  const me = await requireUser(`/g/${groupId}/chat`);
  const { group } = await requireGroup(groupId, me.id);
  return { title: `${group.name} chat` };
}

export default async function ChatPage({ params }: PageProps<"/g/[groupId]/chat">) {
  const { groupId } = await params;
  const me = await requireUser(`/g/${groupId}/chat`);
  const { group } = await requireGroup(groupId, me.id);
  const initial = await getMessages(group.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/g/${group.id}`} className="min-w-0 text-sm text-muted hover:text-ink">
          ← <span className="font-semibold text-ink">{group.name}</span> leaderboard
        </Link>
      </div>
      <Chat groupId={group.id} meId={me.id} initial={initial} />
    </div>
  );
}
