"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { FormMessage, SubmitButton, TextField } from "@/components/ui/form";
import { signIn, type AuthFormState } from "../actions";

const LINK_ERROR = "That link is invalid or has expired. Log in, or request a new link.";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState<AuthFormState, FormData>(signIn, {});
  const linkFailed = searchParams.get("error") === "link";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : linkFailed ? (
        <FormMessage tone="error">{LINK_ERROR}</FormMessage>
      ) : null}
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        error={state.fieldErrors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
    </form>
  );
}
