"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui/form";
import { requestPasswordReset, type AuthFormState } from "../actions";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});

  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
