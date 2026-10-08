/**
 * rcan.encoding — Canonical JSON serialization for RCAN wire formats.
 *
 * RFC 8785 (JSON Canonicalization Scheme), as rcan-spec
 * spec/audit-bundle-v1.md states it, pinned by
 * rcan-spec/fixtures/canonical-json-v1.json:
 *   - Members sorted by name at every nesting level, comparing names as UTF-16
 *     code units; names that look like numbers are compared as strings
 *   - No whitespace
 *   - Numbers are binary64 and written as ECMAScript's Number::toString writes
 *     them (so whole-number floats have no trailing .0, and -0 is 0)
 *   - Non-ASCII Unicode emitted as raw UTF-8 (NOT \uXXXX escapes)
 *   - Empty object = {}, empty array = []
 *   - No trailing newline
 *   - NaN, Infinity and unpaired surrogates have no canonical form and throw
 *     RCANEncodingError
 *
 * The output is written member by member. Building a sorted object and passing
 * it to JSON.stringify does not work: JavaScript objects list integer-like
 * names ("9", "10") first, in numeric order, whatever order they were added
 * in. JSON.stringify is still used for each number and string, because it
 * writes them exactly as RFC 8785 requires.
 */

import { RCANEncodingError } from "./errors.js";

// A high surrogate not followed by a low one, or a low surrogate not preceded
// by a high one.
const UNPAIRED_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function writeString(s: string): string {
  if (UNPAIRED_SURROGATE.test(s)) {
    throw new RCANEncodingError(
      "invalid_string",
      "canonicalJson: a string with an unpaired surrogate has no UTF-8 form (RFC 8785 § 3.2.2.2)",
    );
  }
  return JSON.stringify(s);
}

function write(v: unknown): string | undefined {
  if (v === null) return "null";
  switch (typeof v) {
    case "boolean":
      return v ? "true" : "false";
    case "number":
      if (!Number.isFinite(v)) {
        throw new RCANEncodingError(
          "non_finite_number",
          "canonicalJson: NaN and Infinity have no canonical form (RFC 8785 § 3.2.2.3)",
        );
      }
      return JSON.stringify(v);
    case "string":
      return writeString(v);
    case "object": {
      if (Array.isArray(v)) {
        // As JSON.stringify does, an element with no JSON form, or a hole in a
        // sparse array, is written null. (Array.from visits holes; map skips them.)
        return `[${Array.from(v, (x) => write(x) ?? "null").join(",")}]`;
      }
      const obj = v as Record<string, unknown>;
      const members: string[] = [];
      // Array.prototype.sort compares strings by UTF-16 code units.
      for (const k of Object.keys(obj).sort()) {
        const value = write(obj[k]);
        // As JSON.stringify does, a member with no JSON form (undefined, a
        // function) is left out.
        if (value !== undefined) members.push(`${writeString(k)}:${value}`);
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
 *
 * @throws RCANEncodingError (code "non_finite_number" or "invalid_string") for
 *   a value with no canonical form.
 */
export function canonicalJson(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(write(obj) ?? "null");
}
