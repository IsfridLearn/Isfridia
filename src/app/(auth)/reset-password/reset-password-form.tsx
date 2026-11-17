"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui/form";
import { updatePassword, type AuthFormState } from "../actions";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(updatePassword, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        maxLength={72}
        error={state.fieldErrors?.password}
        hint="At least 8 characters."
      />
      <TextField
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        maxLength={72}
        error={state.fieldErrors?.confirm}
      />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
