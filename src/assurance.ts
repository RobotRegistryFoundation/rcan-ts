/**
 * rcan.assurance — RCAN Appendix C, Physical Assurance Profile (informative).
 *
 * Types for the physical envelope and the gate_decision evidence record, plus
 * the three checks a third party can run with nothing but the log and the
 * envelope:
 *
 *   verifyChain            R5: hash linkage, sequence, per-record hash
 *   auditAuthority         R4: every executed authority-gated command names a
 *                              principal and an authority
 *   replayAgainstEnvelope  R5: every applied command sits inside the declared
 *                              envelope
 *
 * Port of the reference verifier in rcan-spec
 * (scripts/assurance/evidence-chain.ts). Semantics and finding codes are
 * identical; the fixtures in tests/fixtures/assurance/ pin byte-level parity.
 *
 * Informative and optional. These helpers verify evidence, not robots: a
 * passing chain says nothing about whether the machine behaved as logged.
 * Assurance levels A1-A3 are independent of the RCAN protocol conformance
 * levels L1-L4. Conformance is not certification.
 *
 * Hashing uses Web Crypto (SubtleCrypto), which is async, so every function
 * that hashes returns a Promise. This keeps one code path for Node 18+ and
 * browsers. auditAuthority does not hash and is synchronous.
 */

import { canonicalJson } from "./encoding.js";

// ── Types ────────────────────────────────────────────────────────────────────

/** Physical assurance levels: A1 Declared, A2 Enforced, A3 Assured. */
export const ASSURANCE_LEVELS = ["A1", "A2", "A3"] as const;
export type AssuranceLevel = (typeof ASSURANCE_LEVELS)[number];

/** prev value of the first record in a chain: "sha256:" followed by 64 zeros. */
export const GENESIS_PREV = "sha256:" + "0".repeat(64);

export type GateDecisionValue = "allow" | "clamp" | "reject" | "stop";

export type EnvelopePoint = [number, number];
export type EnvelopePolygon = EnvelopePoint[];

/** A proximity rule: either a reduced speed or a stop when a human is within range. */
export type EnvelopeProximityRule =
  | { when: { human_within_m: number }; max_speed_mps: number; action?: "stop" }
  | { when: { human_within_m: number }; action: "stop"; max_speed_mps?: number };

/**
 * Physical envelope (rcan-spec schemas/envelope.json, v0.1). Written and signed
 * by the integrator, never by the model. Nothing here checks that the declared
 * limits are adequate for the task or the site.
 */
export interface Envelope {
  envelope_version: string;
  machine: { id: string; class: string; mass_kg?: number };
  /** Self-declared unless third-party evidence accompanies it. Not an L-level. */
  level: AssuranceLevel;
  workspace: {
    frame: string;
    keep_in: EnvelopePolygon;
    keep_out?: EnvelopePolygon[];
    z_range_m?: [number, number];
  };
  motion: {
    max_speed_mps: number;
    max_turn_radps?: number;
    max_accel_mps2?: number;
    max_joint_speed_radps?: number;
  };
  force?: { max_contact_force_n?: number; max_payload_kg?: number };
  proximity?: EnvelopeProximityRule[];
  sensing?: { max_state_age_ms?: number };
  stop: { category: 0 | 1 | 2; max_time_ms: number; max_distance_m: number };
  heartbeat: { model_timeout_ms: number; gate_timeout_ms: number; on_loss: "stop" };
  authority?: { required_for?: string[]; resolver?: "external" | "local" };
  /** `<alg>:<value>` over the canonical JSON of the envelope without this member. */
  signature?: string;
}

/** One gate_decision evidence record (rcan-spec schemas/gate-decision.json, v0.1). */
export interface GateDecision {
  type: "gate_decision";
  seq: number;
  /** Unix epoch milliseconds. */
  t: number;
  principal: string;
  authority: string | null;
  cmd: Record<string, unknown> | null;
  decision: GateDecisionValue;
  applied: Record<string, unknown> | null;
  /** Required for clamp, reject and stop. */
  reason?: string;
  envelope: string;
  state_digest: string;
  prev: string;
  hash: string;
}

/** One finding from a check. seq is null for chain-level findings. */
export interface AssuranceFinding {
  seq: number | null;
  code: string;
  detail: string;
}

// ── Hashing ──────────────────────────────────────────────────────────────────

async function sha256Prefixed(bytes: Uint8Array): Promise<string> {
  // Same pattern as multimodal.ts: globalThis.crypto (Node 18+, browsers),
  // falling back to node:crypto webcrypto.
  const cryptoModule = "node:crypto";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtle: SubtleCrypto = (globalThis as any).crypto?.subtle
    ?? ((await import(cryptoModule)) as typeof import("node:crypto")).webcrypto.subtle;
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const digest = new Uint8Array(await subtle.digest("SHA-256", ab));
  return "sha256:" + Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function without(obj: object, key: string): Record<string, unknown> {
  const { [key]: _omit, ...rest } = obj as Record<string, unknown>;
  return rest;
}

/** Hash of an envelope: canonical JSON with the signature member removed. */
export function envelopeHash(envelope: object): Promise<string> {
  return sha256Prefixed(canonicalJson(without(envelope, "signature")));
}

/** Hash of a record: canonical JSON with the hash member removed. */
export function recordHash(record: object): Promise<string> {
  return sha256Prefixed(canonicalJson(without(record, "hash")));
}

// ── Chain building and verification ─────────────────────────────────────────

/** Append a record to a chain, filling seq, prev and hash. Returns a new array. */
export async function appendRecord(
  chain: GateDecision[],
  partial: Omit<GateDecision, "seq" | "prev" | "hash">,
): Promise<GateDecision[]> {
  const last = chain[chain.length - 1];
  const rec = {
    ...partial,
    seq: last ? last.seq + 1 : 0,
    prev: last ? last.hash : GENESIS_PREV,
  } as GateDecision;
  rec.hash = await recordHash(rec);
  return [...chain, rec];
}

/**
 * EV-08. Detects mutation, insertion, deletion and reordering of records.
 * It cannot detect removal of records from the END of the chain: that needs
 * the last hash anchored somewhere the writer cannot rewrite (a signed
 * checkpoint, a registry, a second log). Callers that hold such an anchor pass
 * it as expectedHead.
 */
export async function verifyChain(chain: GateDecision[], expectedHead?: string): Promise<AssuranceFinding[]> {
  const findings: AssuranceFinding[] = [];
  for (let i = 0; i < chain.length; i++) {
    const rec = chain[i]!;
    const before = i > 0 ? chain[i - 1]! : undefined;
    const expectedPrev = before ? before.hash : GENESIS_PREV;
    if (i === 0 && rec.seq !== 0) {
      findings.push({ seq: rec.seq, code: "BAD_GENESIS", detail: "first record must have seq 0" });
    }
    if (before && rec.seq !== before.seq + 1) {
      findings.push({ seq: rec.seq, code: "SEQ_GAP", detail: `expected seq ${before.seq + 1}` });
    }
    if (rec.prev !== expectedPrev) {
      findings.push({ seq: rec.seq, code: "PREV_MISMATCH", detail: "prev does not equal the previous record's hash" });
    }
    if ((await recordHash(rec)) !== rec.hash) {
      findings.push({ seq: rec.seq, code: "HASH_MISMATCH", detail: "record contents do not match its hash" });
    }
  }
  if (expectedHead !== undefined) {
    const head = chain.length ? chain[chain.length - 1]!.hash : GENESIS_PREV;
    if (head !== expectedHead) {
      findings.push({ seq: null, code: "HEAD_MISMATCH", detail: "chain head does not match the anchored head" });
    }
  }
  return findings;
}

/**
 * EV-07 (log half). An executed command (allow or clamp) whose kind the
 * envelope lists in authority.required_for must carry a principal and an
 * authority. The command kind is read from cmd.kind; a command without a kind
 * is treated as "motion", the conservative reading.
 */
export function auditAuthority(
  chain: GateDecision[],
  envelope: { authority?: { required_for?: string[] } },
): AssuranceFinding[] {
  const gated = new Set(envelope.authority?.required_for ?? []);
  const findings: AssuranceFinding[] = [];
  for (const rec of chain) {
    if (rec.decision !== "allow" && rec.decision !== "clamp") continue;
    const kind = typeof rec.cmd?.kind === "string" ? (rec.cmd.kind as string) : "motion";
    if (!gated.has(kind)) continue;
    if (!rec.principal) {
      findings.push({ seq: rec.seq, code: "NO_PRINCIPAL", detail: `executed ${kind} command has no principal` });
    }
    if (!rec.authority) {
      findings.push({ seq: rec.seq, code: "NO_AUTHORITY", detail: `executed ${kind} command has no authority` });
    }
  }
  return findings;
}

// ── Replay ───────────────────────────────────────────────────────────────────

function insidePolygon([x, y]: EnvelopePoint, poly: EnvelopePoint[]): boolean {
  // Ray casting. Points exactly on an edge count as inside.
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    const onSegment =
      Math.abs(cross) < 1e-12 &&
      x >= Math.min(xi, xj) && x <= Math.max(xi, xj) &&
      y >= Math.min(yi, yj) && y <= Math.max(yi, yj);
    if (onSegment) return true;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The parts of an envelope the replay reads. Any full Envelope satisfies it. */
export interface ReplayEnvelope {
  workspace?: { keep_in?: EnvelopePoint[]; keep_out?: EnvelopePoint[][] };
  motion?: { max_speed_mps?: number; max_turn_radps?: number };
}

/**
 * Replay every applied command against the envelope. Understands the
 * illustrative command shape used in Appendix C:
 * { kind, linear_mps, angular_radps, target: [x, y] }. Fields it does not
 * understand are not judged, and the replay says so by returning
 * UNCHECKED_FIELDS once per field name, so silence is never read as a pass.
 */
export async function replayAgainstEnvelope(
  chain: GateDecision[],
  envelope: ReplayEnvelope & object,
): Promise<AssuranceFinding[]> {
  const findings: AssuranceFinding[] = [];
  const hash = await envelopeHash(envelope);
  const unchecked = new Set<string>();
  const known = new Set(["kind", "linear_mps", "angular_radps", "target"]);
  const maxV = envelope.motion?.max_speed_mps;
  const maxW = envelope.motion?.max_turn_radps;
  const keepIn = envelope.workspace?.keep_in;
  const keepOut = envelope.workspace?.keep_out ?? [];

  for (const rec of chain) {
    if (rec.envelope !== hash) {
      findings.push({ seq: rec.seq, code: "ENVELOPE_MISMATCH", detail: "record was decided under a different envelope" });
    }
    if (rec.decision === "reject") {
      if (rec.applied !== null) findings.push({ seq: rec.seq, code: "REJECT_APPLIED", detail: "reject must apply nothing" });
      continue;
    }
    const a = rec.applied ?? {};
    for (const k of Object.keys(a)) if (!known.has(k)) unchecked.add(k);
    const v = typeof a.linear_mps === "number" ? a.linear_mps : undefined;
    const w = typeof a.angular_radps === "number" ? a.angular_radps : undefined;

    if (rec.decision === "stop") {
      if ((v !== undefined && v !== 0) || (w !== undefined && w !== 0)) {
        findings.push({ seq: rec.seq, code: "STOP_WITH_MOTION", detail: "stop applied a non-zero velocity" });
      }
      continue;
    }
    if (v !== undefined && maxV !== undefined && Math.abs(v) > maxV) {
      findings.push({ seq: rec.seq, code: "SPEED_EXCEEDED", detail: `|${v}| > max_speed_mps ${maxV}` });
    }
    if (w !== undefined && maxW !== undefined && Math.abs(w) > maxW) {
      findings.push({ seq: rec.seq, code: "TURN_EXCEEDED", detail: `|${w}| > max_turn_radps ${maxW}` });
    }
    const target = a.target as EnvelopePoint | undefined;
    if (Array.isArray(target) && target.length === 2) {
      if (keepIn && !insidePolygon(target, keepIn)) {
        findings.push({ seq: rec.seq, code: "OUTSIDE_KEEP_IN", detail: `target ${JSON.stringify(target)} outside keep_in` });
      }
      for (const zone of keepOut) {
        if (insidePolygon(target, zone)) {
          findings.push({ seq: rec.seq, code: "INSIDE_KEEP_OUT", detail: `target ${JSON.stringify(target)} inside keep_out` });
        }
      }
    }
  }
  for (const k of unchecked) {
    findings.push({ seq: null, code: "UNCHECKED_FIELDS", detail: `applied.${k} is not judged by this reference replay` });
  }
  return findings;
}
