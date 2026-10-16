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
 * Assurance levels BE-1 to BE-3 (named A1-A3 before rcan-spec #226) are
 * independent of the RCAN protocol conformance levels L1-L4. Conformance is
 * not certification.
 *
 * RCAN is one open implementation of the Bounded Embodiment property. The
 * property and its vendor-neutral method do not depend on RCAN:
 * https://github.com/RobotRegistryFoundation/bounded-embodiment
 *
 * Hashing uses Web Crypto (SubtleCrypto), which is async, so every function
 * that hashes returns a Promise. This keeps one code path for Node 18+ and
 * browsers. auditAuthority does not hash and is synchronous.
 */

import { canonicalJson } from "./encoding.js";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Physical assurance levels as schemas/envelope.json names them since
 * rcan-spec #226: BE-1 Declared, BE-2 Enforced, BE-3 Assured.
 */
export const BE_LEVELS = ["BE-1", "BE-2", "BE-3"] as const;

/**
 * The earlier names of the same levels (A1 Declared, A2 Enforced, A3 Assured).
 * Kept unchanged for compatibility; the current schema accepts only BE_LEVELS
 * in envelope.level.
 */
export const ASSURANCE_LEVELS = ["A1", "A2", "A3"] as const;
export type AssuranceLevel = (typeof BE_LEVELS)[number] | (typeof ASSURANCE_LEVELS)[number];

/** gate_decision.stop_kind values (Appendix C.1.3). Only with decision stop. */
export const STOP_KINDS = ["protective", "repeated", "emergency"] as const;
export type StopKind = (typeof STOP_KINDS)[number];

/** envelope.recovery.on_reject values (Appendix C.1.3). */
export const ON_REJECT_BEHAVIOURS = ["hold", "slow_down"] as const;

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
  stop: {
    category: 0 | 1 | 2;
    max_time_ms: number;
    max_distance_m: number;
    /**
     * Optional. The state the machine ends in after a stop, declared by the
     * integrator, because stopped is not always safe (Appendix C.1.3). Free
     * text in v0.1, e.g. stop_in_place, hold, set_down,
     * controlled_crouch_then_power_off.
     */
    safe_state?: string;
  };
  /** Optional. What happens after the gate says no (Appendix C.1.3). */
  recovery?: EnvelopeRecovery;
  heartbeat: { model_timeout_ms: number; gate_timeout_ms: number; on_loss: "stop" };
  authority?: { required_for?: string[]; resolver?: "external" | "local" };
  /** `<alg>:<value>` over the canonical JSON of the envelope without this member. */
  signature?: string;
}

/** envelope.recovery (Appendix C.1.3). */
export interface EnvelopeRecovery {
  on_reject?: (typeof ON_REJECT_BEHAVIOURS)[number];
  /** At least one of escalate_after_count and escalate_after_s. */
  repeated_stops?: {
    escalate_after_count?: number;
    count_window_s?: number;
    escalate_after_s?: number;
  };
  /** Only "manual": reset is done by a person and never restarts motion by itself. */
  estop_reset?: "manual";
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
  /** Optional, only with decision stop (Appendix C.1.3). Covered by hash. */
  stop_kind?: StopKind;
  /** Optional, not with allow: the reason went back to the proposing model to re-plan. */
  reason_returned?: boolean;
  envelope: string;
  state_digest: string;
  prev: string;
  hash: string;
}

/** One finding from a check. seq is null for chain-level findings. */
export interface AssuranceFinding {
  seq: number | null;
  code: string;
  /** The member name, for UNCHECKED_FIELDS only. */
  field?: string;
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

// ── Input shape ──────────────────────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const nonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/**
 * The record shape the checks rely on: objects whose seq is a non-negative
 * integer, and for verifyChain string prev and hash. Without it a finding means
 * nothing (a missing seq used to produce "expected seq NaN"), so such input
 * throws a TypeError instead of being judged.
 */
function requireRecords(chain: unknown, links: boolean): void {
  if (!Array.isArray(chain)) throw new TypeError("records: expected an array of gate_decision records");
  chain.forEach((rec, i) => {
    if (!isObject(rec)) throw new TypeError(`records[${i}]: not an object`);
    if (!(typeof rec.seq === "number" && Number.isInteger(rec.seq) && rec.seq >= 0)) {
      throw new TypeError(`records[${i}]: seq must be a non-negative integer`);
    }
    if (links && (typeof rec.prev !== "string" || typeof rec.hash !== "string")) {
      throw new TypeError(`records[${i}]: prev and hash must be strings`);
    }
  });
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
  requireRecords(chain, true);
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
 * authority, each a non-empty string. The command kind is read from cmd.kind;
 * a command without a kind is treated as "motion", the conservative reading.
 * Only string entries of an array required_for gate a kind.
 */
export function auditAuthority(
  chain: GateDecision[],
  envelope: { authority?: { required_for?: string[] } },
): AssuranceFinding[] {
  requireRecords(chain, false);
  const authority: unknown = envelope.authority;
  const requiredFor = isObject(authority) ? authority.required_for : undefined;
  const gated = new Set(Array.isArray(requiredFor) ? requiredFor.filter((k) => typeof k === "string") : []);
  const findings: AssuranceFinding[] = [];
  for (const rec of chain) {
    if (rec.decision !== "allow" && rec.decision !== "clamp") continue;
    const cmd: unknown = rec.cmd;
    const kind = isObject(cmd) && typeof cmd.kind === "string" ? cmd.kind : "motion";
    if (!gated.has(kind)) continue;
    if (!nonEmptyString(rec.principal)) {
      findings.push({ seq: rec.seq, code: "NO_PRINCIPAL", detail: `executed ${kind} command has no principal` });
    }
    if (!nonEmptyString(rec.authority)) {
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

const DECISIONS = new Set<string>(["allow", "clamp", "reject", "stop"]);
const isNumber = (v: unknown): v is number => typeof v === "number";
/** Two finite numbers. */
const isPoint = (v: unknown): v is EnvelopePoint =>
  Array.isArray(v) && v.length === 2 && v.every((c) => typeof c === "number" && Number.isFinite(c));
/** Three or more points. */
const isPolygon = (v: unknown): v is EnvelopePoint[] => Array.isArray(v) && v.length >= 3 && v.every(isPoint);
const canonicalText = (v: unknown): string => new TextDecoder().decode(canonicalJson(v as Record<string, unknown>));

/**
 * Replay every record against the envelope and against the decision table in
 * Appendix C (C.1.1, C.6): allow applies the command unchanged; clamp, reject
 * and stop carry a reason; reject applies null; the others apply an object.
 *
 * Understands the illustrative command shape used in Appendix C:
 * { kind, linear_mps, angular_radps, target: [x, y] }. A bound, polygon or
 * target is used only when it has the type replay needs (a number; three or
 * more points; two finite numbers), so nothing is judged through type
 * coercion. Members of applied that replay cannot judge, because the name is
 * unknown or the value unusable, are reported as UNCHECKED_FIELDS once per
 * name, sorted, so silence is never read as a pass.
 */
export async function replayAgainstEnvelope(
  chain: GateDecision[],
  envelope: ReplayEnvelope & object,
): Promise<AssuranceFinding[]> {
  requireRecords(chain, false);
  const findings: AssuranceFinding[] = [];
  const hash = await envelopeHash(envelope);
  const unchecked = new Set<string>();
  const motion: Record<string, unknown> = isObject(envelope.motion) ? envelope.motion : {};
  const workspace: Record<string, unknown> = isObject(envelope.workspace) ? envelope.workspace : {};
  const maxV = isNumber(motion.max_speed_mps) ? motion.max_speed_mps : undefined;
  const maxW = isNumber(motion.max_turn_radps) ? motion.max_turn_radps : undefined;
  const keepIn = isPolygon(workspace.keep_in) ? workspace.keep_in : undefined;
  const keepOut = Array.isArray(workspace.keep_out) ? workspace.keep_out.filter(isPolygon) : [];

  for (const rec of chain) {
    const seq = rec.seq;
    if (rec.envelope !== hash) {
      findings.push({ seq, code: "ENVELOPE_MISMATCH", detail: "record was decided under a different envelope" });
    }
    if (!DECISIONS.has(rec.decision)) {
      findings.push({ seq, code: "UNKNOWN_DECISION", detail: `decision ${JSON.stringify(rec.decision)} is not allow, clamp, reject or stop` });
      continue;
    }
    const applied: unknown = rec.applied;
    if (rec.decision === "reject") {
      // A missing applied member is not the null that reject requires.
      if (!Object.prototype.hasOwnProperty.call(rec, "applied") || applied !== null) {
        findings.push({ seq, code: "REJECT_APPLIED", detail: "reject must apply null" });
      }
    } else if (!isObject(applied)) {
      findings.push({ seq, code: "APPLIED_NOT_OBJECT", detail: `${rec.decision} must apply an object` });
    } else {
      const v = isNumber(applied.linear_mps) ? applied.linear_mps : undefined;
      const w = isNumber(applied.angular_radps) ? applied.angular_radps : undefined;
      const target = rec.decision !== "stop" && isPoint(applied.target) ? applied.target : undefined;
      for (const k of Object.keys(applied)) {
        const judged =
          k === "kind" ||
          (k === "linear_mps" && v !== undefined) ||
          (k === "angular_radps" && w !== undefined) ||
          (k === "target" && target !== undefined);
        if (!judged) unchecked.add(k);
      }
      if (rec.decision === "stop") {
        if ((v !== undefined && v !== 0) || (w !== undefined && w !== 0)) {
          findings.push({ seq, code: "STOP_WITH_MOTION", detail: "stop applied a non-zero velocity" });
        }
      } else {
        if (v !== undefined && maxV !== undefined && Math.abs(v) > maxV) {
          findings.push({ seq, code: "SPEED_EXCEEDED", detail: `|${v}| > max_speed_mps ${maxV}` });
        }
        if (w !== undefined && maxW !== undefined && Math.abs(w) > maxW) {
          findings.push({ seq, code: "TURN_EXCEEDED", detail: `|${w}| > max_turn_radps ${maxW}` });
        }
        if (target) {
          if (keepIn && !insidePolygon(target, keepIn)) {
            findings.push({ seq, code: "OUTSIDE_KEEP_IN", detail: `target ${JSON.stringify(target)} outside keep_in` });
          }
          for (const zone of keepOut) {
            if (insidePolygon(target, zone)) {
              findings.push({ seq, code: "INSIDE_KEEP_OUT", detail: `target ${JSON.stringify(target)} inside keep_out` });
            }
          }
        }
        // A missing cmd counts as null.
        if (rec.decision === "allow" && canonicalText(applied) !== canonicalText(rec.cmd ?? null)) {
          findings.push({ seq, code: "ALLOW_MODIFIED", detail: "allow must apply the command unchanged" });
        }
      }
    }
    if (rec.decision !== "allow" && !nonEmptyString(rec.reason)) {
      findings.push({ seq, code: "MISSING_REASON", detail: `${rec.decision} must give a reason` });
    }
  }
  for (const k of [...unchecked].sort()) {
    findings.push({ seq: null, code: "UNCHECKED_FIELDS", field: k, detail: `applied.${k} is not judged by this reference replay` });
  }
  return findings;
}

// ── Recovery fields (Appendix C.1.3) ─────────────────────────────────────────
//
// The conditional rules schemas/envelope.json and gate-decision.json place on
// the optional recovery fields added in rcan-spec #232. Not a full schema
// validation: only those fields are checked. Synchronous (no hashing).

const RECOVERY_KEYS = new Set(["on_reject", "repeated_stops", "estop_reset"]);
const REPEATED_STOPS_KEYS = new Set(["escalate_after_count", "count_window_s", "escalate_after_s"]);

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Check stop.safe_state and recovery against schemas/envelope.json. Both are
 * optional; an envelope without them returns no findings. Codes:
 * BAD_SAFE_STATE, BAD_RECOVERY, BAD_ON_REJECT, BAD_REPEATED_STOPS,
 * ESTOP_RESET_NOT_MANUAL. All findings have seq null.
 */
export function checkEnvelopeRecovery(envelope: object): AssuranceFinding[] {
  const findings: AssuranceFinding[] = [];
  const bad = (code: string, detail: string) => findings.push({ seq: null, code, detail });
  const env = envelope as Record<string, unknown>;

  const stop = env.stop;
  if (isObj(stop) && has(stop, "safe_state")) {
    const ss = stop.safe_state;
    if (!(typeof ss === "string" && ss.length >= 1)) bad("BAD_SAFE_STATE", "stop.safe_state must be a non-empty string");
  }

  if (!has(env, "recovery")) return findings;
  const rec = env.recovery;
  if (!isObj(rec)) {
    bad("BAD_RECOVERY", "recovery must be an object");
    return findings;
  }
  for (const k of Object.keys(rec).filter((k) => !RECOVERY_KEYS.has(k)).sort()) {
    bad("BAD_RECOVERY", `recovery.${k} is not a recovery member`);
  }
  if (has(rec, "on_reject") && !(ON_REJECT_BEHAVIOURS as readonly unknown[]).includes(rec.on_reject)) {
    bad("BAD_ON_REJECT", "recovery.on_reject must be hold or slow_down");
  }
  if (has(rec, "estop_reset") && rec.estop_reset !== "manual") {
    bad("ESTOP_RESET_NOT_MANUAL", "recovery.estop_reset must be manual: reset alone never restarts motion");
  }
  if (has(rec, "repeated_stops")) {
    const rs = rec.repeated_stops;
    if (!isObj(rs)) {
      bad("BAD_REPEATED_STOPS", "recovery.repeated_stops must be an object");
      return findings;
    }
    for (const k of Object.keys(rs).filter((k) => !REPEATED_STOPS_KEYS.has(k)).sort()) {
      bad("BAD_REPEATED_STOPS", `recovery.repeated_stops.${k} is not a member`);
    }
    if (!has(rs, "escalate_after_count") && !has(rs, "escalate_after_s")) {
      bad("BAD_REPEATED_STOPS", "recovery.repeated_stops needs escalate_after_count, escalate_after_s or both");
    }
    if (has(rs, "escalate_after_count")) {
      const n = rs.escalate_after_count;
      if (!(typeof n === "number" && Number.isInteger(n) && n >= 1)) {
        bad("BAD_REPEATED_STOPS", "recovery.repeated_stops.escalate_after_count must be an integer >= 1");
      }
    }
    for (const k of ["count_window_s", "escalate_after_s"]) {
      if (has(rs, k)) {
        const v = rs[k];
        if (!(typeof v === "number" && Number.isFinite(v) && v > 0)) {
          bad("BAD_REPEATED_STOPS", `recovery.repeated_stops.${k} must be a number > 0`);
        }
      }
    }
  }
  return findings;
}

/**
 * Check stop_kind and reason_returned against schemas/gate-decision.json:
 * stop_kind is one of STOP_KINDS and appears only with decision stop;
 * reason_returned is a boolean and never appears with allow. Codes:
 * BAD_STOP_KIND, STOP_KIND_WITHOUT_STOP, BAD_REASON_RETURNED,
 * REASON_RETURNED_WITH_ALLOW.
 */
export function checkStopFields(chain: readonly object[]): AssuranceFinding[] {
  const findings: AssuranceFinding[] = [];
  for (const r of chain) {
    if (!isObj(r)) continue;
    const seq = typeof r.seq === "number" ? r.seq : null;
    if (has(r, "stop_kind")) {
      if (!(STOP_KINDS as readonly unknown[]).includes(r.stop_kind)) {
        findings.push({ seq, code: "BAD_STOP_KIND", detail: "stop_kind must be protective, repeated or emergency" });
      }
      if (r.decision !== "stop") {
        findings.push({ seq, code: "STOP_KIND_WITHOUT_STOP", detail: "stop_kind is only valid with decision stop" });
      }
    }
    if (has(r, "reason_returned")) {
      if (typeof r.reason_returned !== "boolean") {
        findings.push({ seq, code: "BAD_REASON_RETURNED", detail: "reason_returned must be a boolean" });
      }
      if (r.decision === "allow") {
        findings.push({ seq, code: "REASON_RETURNED_WITH_ALLOW", detail: "reason_returned is not valid with decision allow" });
      }
    }
  }
  return findings;
}
