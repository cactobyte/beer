"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action] = useActionState(mode === "login" ? login : signup, undefined);
  const qs = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form action={action} className="card space-y-4 p-6">
      <input type="hidden" name="next" value={next ?? "/"} />
      <div>
        <label className="label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </div>
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="displayName">
            Display name
          </label>
          <input id="displayName" name="displayName" className="input" placeholder="What your mates call you" required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? 8 : undefined}
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={mode === "login" ? "Logging in…" : "Creating account…"}>
        {mode === "login" ? "Log in" : "Create account"}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href={`/signup${qs}`} className="text-foam hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Got an account?{" "}
            <Link href={`/login${qs}`} className="text-foam hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
