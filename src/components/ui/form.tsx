"use client";

import { useFormStatus } from "react-dom";

// Shared form pieces so every form looks and behaves the same.

type TextFieldProps = {
  label: string;
  name: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  maxLength?: number;
};

export function TextField({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  error,
  hint,
  required = true,
  maxLength,
}: TextFieldProps) {
  const id = `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-fg-soft">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-11 rounded-[10px] border bg-surface px-3 text-[15px] text-fg placeholder:text-faint ${
          error ? "border-danger-strong" : "border-line-strong"
        }`}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-xl bg-accent px-5 font-bold text-on-accent transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[10px] border px-3 py-2.5 text-sm ${
        tone === "error"
          ? "border-danger-strong/40 bg-danger-strong/10 text-danger"
          : "border-ongoing/30 bg-ongoing-bg text-ongoing"
      }`}
    >
      {children}
    </p>
  );
}
