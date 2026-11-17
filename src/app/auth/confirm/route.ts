import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

// Every link in a Supabase auth email (confirm signup, reset password) lands
// here. We verify the link, which logs the user in, then send them on.
//
// Two link styles are accepted:
//   ?token_hash=...&type=...  works when the email is opened on any device
//                             (needs the email-template change in README.md)
//   ?code=...                 Supabase's default; only works in the same
//                             browser that asked for the email
const EMAIL_TYPES: readonly EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));

  const supabase = await createClient();
  let verified = false;

  if (tokenHash && type && EMAIL_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    verified = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  }

  redirect(verified ? next : "/login?error=link");
}
