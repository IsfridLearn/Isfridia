// Only allow redirects to paths on this site ("/account"), never to another
// site ("//evil.com", "https://evil.com"). Stops "open redirect" phishing links.
export function safeNextPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
