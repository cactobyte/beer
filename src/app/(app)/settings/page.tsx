import { logout } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireUser("/settings");
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>
      <ProfileForm displayName={me.displayName} emoji={me.emoji} />
      <PasswordForm />
      <form action={logout}>
        <button type="submit" className="btn btn-danger w-full">
          Log out
        </button>
      </form>
    </div>
  );
}
