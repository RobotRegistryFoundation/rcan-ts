/**
 * RCAN Protocol Version — single source of truth.
 *
 * All modules that need SPEC_VERSION import from here.
 * §3.5 — Protocol Version Compatibility
 */

/** The RCAN spec version this SDK implements. */
export const SPEC_VERSION = "3.2";

/** The SDK release version. */
export const SDK_VERSION = "3.5.0";

/**
 * Validate version compatibility.
 *
 * MAJOR must match. Lower-or-equal MINOR is acceptable.
 *
 * @param incomingVersion - The rcanVersion from the incoming message
 * @param localVersion    - The local SPEC_VERSION (defaults to SPEC_VERSION)
 * @returns true if compatible, false if MAJOR mismatch
 */
export function validateVersionCompat(
  incomingVersion: string,
  localVersion: string = SPEC_VERSION
): boolean {
  const parseParts = (v: string): [number, number] => {
    const parts = v.split(".");
    const major = parseInt(parts[0] ?? "0", 10);
    const minor = parseInt(parts[1] ?? "0", 10);
    return [isNaN(major) ? 0 : major, isNaN(minor) ? 0 : minor];
  };

  const [inMajor] = parseParts(incomingVersion);
  const [localMajor] = parseParts(localVersion);

  // MAJOR must match
  return inMajor === localMajor;
}
