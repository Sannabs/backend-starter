import crypto from "node:crypto";

/** Stable stringify: key order must not change the output. */
export const canonicalJson = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonicalJson).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value as object)
          .sort()
          .map(
            (key) =>
              `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
          )
          .join(",")}}`
      : JSON.stringify(value ?? null);

export const sha256 = (input: string): string =>
  crypto.createHash("sha256").update(input).digest("hex");

/** Fingerprint of arbitrary parts. Order of the parts array IS significant. */
export const fingerprint = (...parts: unknown[]): string =>
  sha256(parts.map(canonicalJson).join("|"));
