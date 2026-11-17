"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui/form";
import { signUp, type AuthFormState } from "../actions";

export function RegisterForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(signUp, {});

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
      <TextField
        label="Username"
        name="username"
        autoComplete="username"
        maxLength={24}
        defaultValue={state.username}
        error={state.fieldErrors?.username}
        hint="3–24 characters: lowercase letters, numbers or _. Shown publicly."
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        maxLength={72}
        error={state.fieldErrors?.password}
        hint="At least 8 characters."
      />
      <TextField
        label="Confirm password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        maxLength={72}
        error={state.fieldErrors?.confirm}
      />
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
