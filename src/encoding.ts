/**
 * rcan.encoding — Canonical JSON serialization for RCAN wire formats.
 *
 * RFC 8785 (JSON Canonicalization Scheme), as rcan-spec
 * spec/audit-bundle-v1.md states it, pinned by
 * rcan-spec/fixtures/canonical-json-v1.json:
 *   - Members sorted by name at every nesting level, comparing names as UTF-16
 *     code units; names that look like numbers are compared as strings
 *   - No whitespace
 *   - Numbers written as ECMAScript's Number::toString writes them (so
 *     whole-number floats have no trailing .0, and -0 is 0)
 *   - Non-ASCII Unicode emitted as raw UTF-8 (NOT \uXXXX escapes)
 *   - Empty object = {}, empty array = []
 *   - No trailing newline
 *
 * The output is written member by member. Building a sorted object and passing
 * it to JSON.stringify does not work: JavaScript objects list integer-like
 * names ("9", "10") first, in numeric order, whatever order they were added
 * in. JSON.stringify is still used for each number and string, because it
 * writes them exactly as RFC 8785 requires.
 */

function write(v: unknown): string | undefined {
  if (v === null) return "null";
  switch (typeof v) {
    case "boolean":
      return v ? "true" : "false";
    case "number":
    case "string":
      return JSON.stringify(v);
    case "object": {
      if (Array.isArray(v)) {
        // As JSON.stringify does, an element with no JSON form is written null.
        return `[${v.map((x) => write(x) ?? "null").join(",")}]`;
      }
      const obj = v as Record<string, unknown>;
      const members: string[] = [];
      // Array.prototype.sort compares strings by UTF-16 code units.
      for (const k of Object.keys(obj).sort()) {
        const value = write(obj[k]);
        // As JSON.stringify does, a member with no JSON form (undefined, a
        // function) is left out.
        if (value !== undefined) members.push(`${JSON.stringify(k)}:${value}`);
      }
      return `{${members.join(",")}}`;
    }
    case "bigint":
      throw new TypeError("canonicalJson: a BigInt has no JSON form");
    default:
      return undefined; // undefined, function, symbol
  }
}

/**
 * Return the canonical UTF-8 bytes of `obj`.
 * Deterministic: equivalent inputs yield identical bytes.
 */
export function canonicalJson(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(write(obj) ?? "null");
}
