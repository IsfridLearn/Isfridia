"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui/form";
import { changePassword, updateProfile, type AccountFormState } from "./actions";

export function ProfileForm({ username, displayName }: { username: string; displayName: string }) {
  const [state, action] = useActionState<AccountFormState, FormData>(updateProfile, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage> : null}
      <TextField label="Username" name="username" defaultValue={username} maxLength={24} autoComplete="username" error={state.fieldErrors?.username} hint="Shown publicly. 3–24 characters: lowercase letters, numbers or _." />
      <TextField label="Display name" name="displayName" defaultValue={displayName} maxLength={50} required={false} error={state.fieldErrors?.displayName} hint="Optional." />
      <div>
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<AccountFormState, FormData>(changePassword, {});
  return (
    // A new key after success clears the fields.
    <form key={state.ok ? state.submission : "password"} action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage> : null}
      <TextField label="New password" name="password" type="password" autoComplete="new-password" maxLength={72} error={state.fieldErrors?.password} hint="At least 8 characters." />
      <TextField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" maxLength={72} error={state.fieldErrors?.confirm} />
      <div>
        <SubmitButton pendingText="Saving…">Change password</SubmitButton>
      </div>
    </form>
  );
}
