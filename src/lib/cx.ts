// Tiny className joiner — drops falsy values so conditional classes read clean.
export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
