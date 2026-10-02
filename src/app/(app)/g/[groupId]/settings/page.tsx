import Link from "next/link";
import { leaveGroup, regenerateInvite, removeMember } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";
import { LiveRefresh } from "@/components/LiveRefresh";
import { requireUser } from "@/lib/auth";
import { getGroupCatalog } from "@/lib/catalog";
import { getGroupMembers, requireGroup } from "@/lib/queries";
import { GroupSettingsForm } from "./form";
import { DrinksManager } from "./drinks";
import { NicknameEditor } from "./nickname";

export const metadata = { title: "Group settings" };

export default async function GroupSettingsPage({ params }: PageProps<"/g/[groupId]/settings">) {
  const { groupId } = await params;
  const me = await requireUser(`/g/${groupId}/settings`);
  const { group, role } = await requireGroup(groupId, me.id);
  const [members, catalog] = await Promise.all([getGroupMembers(group.id), getGroupCatalog(group.id)]);
  const isOwner = role === "owner";
  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(group.timezone)) timezones.unshift(group.timezone);

  return (
    <div className="space-y-5">
      <LiveRefresh groupId={group.id} />
      <div>
        <Link href={`/g/${group.id}`} className="text-sm text-muted hover:text-ink">
          ← {group.name}
        </Link>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Group settings</h1>
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Invite</h2>
        <p className="text-sm text-muted">
          Send your mates the link, or tell them the code:{" "}
          <span className="font-mono text-lg font-semibold tracking-widest text-ink">{group.inviteCode}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={`/join/${group.inviteCode}`} label="Copy invite link" />
          {isOwner && (
            <ConfirmButton
              action={regenerateInvite.bind(null, group.id)}
              confirm="Make a new code? The old link will stop working."
              className="btn btn-ghost"
            >
              New code
            </ConfirmButton>
          )}
        </div>
      </section>

      {isOwner && (
        <GroupSettingsForm
          groupId={group.id}
          name={group.name}
          timezone={group.timezone}
          timezones={timezones}
        />
      )}

      {isOwner && (
        <DrinksManager
          groupId={group.id}
          hidden={catalog.hidden}
          customs={catalog.customs.map(({ id, label, emoji, units }) => ({ id, label, emoji, units }))}
        />
      )}

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-5 py-3 font-display text-lg font-semibold">Members ({members.length})</h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
              <Avatar emoji={m.emoji} size="sm" />
              <Link href={`/u/${m.username}`} prefetch={false} className="min-w-0 flex-1 truncate hover:underline">
                <span className="font-medium">{m.displayName}</span>{" "}
                <span className="text-sm text-dim">
                  @{m.username}
                  {m.nickname && ` · ${m.realName}`}
                </span>
              </Link>
              {m.role === "owner" && <span className="text-xs text-foam">owner</span>}
              {isOwner && (
                <NicknameEditor groupId={group.id} userId={m.userId} nickname={m.nickname} realName={m.realName} />
              )}
              {isOwner && m.role !== "owner" && (
                <ConfirmButton
                  action={removeMember.bind(null, group.id, m.userId)}
                  confirm={`Remove ${m.displayName} from the group?`}
                  className="text-xs text-dim hover:text-danger"
                >
                  Remove
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Leave group</h2>
        <p className="text-sm text-muted">
          Your drinks stay on your profile.
          {isOwner && members.length > 1 && " Ownership passes to the longest-standing member."}
          {isOwner && members.length === 1 && " You’re the last one here, so the group will be deleted."}
        </p>
        <ConfirmButton action={leaveGroup.bind(null, group.id)} confirm={`Leave ${group.name}?`}>
          Leave group
        </ConfirmButton>
      </section>
    </div>
  );
}
