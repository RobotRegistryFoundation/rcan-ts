/**
 * Appendix C (Physical Assurance Profile, informative): evidence-chain verifier.
 *
 * Fixtures are copied from rcan-spec (see tests/fixtures/assurance/README.md).
 * The per-record hash assertions prove cross-implementation parity with the
 * rcan-spec reference verifier. These tests check the verification method on
 * fixtures. They do not test any robot.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSURANCE_LEVELS,
  GENESIS_PREV,
  appendRecord,
  auditAuthority,
  canonicalJson,
  envelopeHash,
  recordHash,
  replayAgainstEnvelope,
  verifyChain,
  type Envelope,
  type GateDecision,
} from "../src/index.js";

const _dirname = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(_dirname, "fixtures", p), "utf-8"));

const ENVELOPE: Envelope = read("assurance/envelope-rover.valid.json");
const ARM: Envelope = read("assurance/envelope-tabletop-arm.valid.json");
const CHAIN: GateDecision[] = read("assurance/gate-decision-rover-chain.valid.json");
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const codes = (f: { code: string }[]) => f.map((x) => x.code);

describe("canonical JSON: existing encoding.canonicalJson matches canonical-json-v1.json", () => {
  const suite = read("canonical-json-v1.json");
  for (const c of suite.cases) {
    test(c.name, () => {
      expect(Buffer.from(canonicalJson(c.input)).toString("base64")).toBe(c.expected_bytes_base64);
    });
  }
});

describe("cross-implementation parity with the rcan-spec reference verifier", () => {
  test.each(CHAIN.map((r) => [r.seq, r]))("recordHash(record %i) equals the fixture's stored hash", async (_seq, rec) => {
    expect(await recordHash(rec as GateDecision)).toBe((rec as GateDecision).hash);
  });

  test("envelopeHash(rover envelope) equals the envelope hash stored in every record", async () => {
    const h = await envelopeHash(ENVELOPE);
    expect(h).toBe("sha256:ef796735bbfa6b725807fe56199b4ed06d90fe16448c06e0777e599362f36731");
    for (const r of CHAIN) expect(r.envelope).toBe(h);
  });

  test("rebuilding the chain with appendRecord reproduces every seq, prev and hash", async () => {
    let rebuilt: GateDecision[] = [];
    for (const r of CHAIN) {
      const { seq: _s, prev: _p, hash: _h, ...partial } = r;
      rebuilt = await appendRecord(rebuilt, partial);
    }
    expect(rebuilt).toEqual(CHAIN);
  });
});

describe("types and constants", () => {
  test("ASSURANCE_LEVELS is A1..A3 and contains no protocol L-level", () => {
    expect([...ASSURANCE_LEVELS]).toEqual(["A1", "A2", "A3"]);
  });
  test("GENESIS_PREV is sha256: plus 64 zeros", () => {
    expect(GENESIS_PREV).toBe("sha256:" + "0".repeat(64));
  });
  test("both envelope fixtures fit the Envelope type", () => {
    expect(ENVELOPE.level).toBe("A2");
    expect(ARM.level).toBe("A1");
  });
});

describe("fixture chain", () => {
  test("verifies clean", async () => expect(await verifyChain(CHAIN)).toEqual([]));
  test("starts at the genesis prev", () => expect(CHAIN[0]!.prev).toBe(GENESIS_PREV));
  test("envelope hash ignores the signature member", async () => {
    expect(await envelopeHash({ ...ENVELOPE, signature: "ed25519:other" })).toBe(await envelopeHash(ENVELOPE));
  });
  test("empty chain verifies clean and its head is GENESIS_PREV", async () => {
    expect(await verifyChain([])).toEqual([]);
    expect(await verifyChain([], GENESIS_PREV)).toEqual([]);
  });
});

describe("EV-08 log tampering", () => {
  test("mutating a field is detected", async () => {
    const c = clone(CHAIN);
    (c[1]!.applied as Record<string, number>).linear_mps = 0.9;
    expect(codes(await verifyChain(c))).toContain("HASH_MISMATCH");
  });

  test("mutating a field and re-hashing that record breaks the next link", async () => {
    const c = clone(CHAIN);
    c[1]!.decision = "allow";
    c[1]!.hash = await recordHash(c[1]!);
    expect(codes(await verifyChain(c))).toContain("PREV_MISMATCH");
  });

  test("deleting a record is detected", async () => {
    const c = clone(CHAIN);
    c.splice(2, 1);
    expect(codes(await verifyChain(c))).toEqual(expect.arrayContaining(["SEQ_GAP", "PREV_MISMATCH"]));
  });

  test("inserting a forged record is detected", async () => {
    const c = clone(CHAIN);
    const forged = { ...clone(c[0]!), seq: 1, prev: c[0]!.hash, t: c[0]!.t + 1 };
    forged.hash = await recordHash(forged);
    c.splice(1, 0, forged);
    expect(codes(await verifyChain(c))).toEqual(expect.arrayContaining(["SEQ_GAP", "PREV_MISMATCH"]));
  });

  test("reordering records is detected", async () => {
    const c = clone(CHAIN);
    [c[2], c[3]] = [c[3]!, c[2]!];
    expect((await verifyChain(c)).length).toBeGreaterThan(0);
  });

  test("a chain not starting at seq 0 is flagged BAD_GENESIS", async () => {
    expect(codes(await verifyChain(CHAIN.slice(1)))).toContain("BAD_GENESIS");
  });

  test("truncating the tail is NOT detectable from the chain alone", async () => {
    // Stated limit of a hash chain, asserted so nobody reads the verifier as covering it.
    expect(await verifyChain(CHAIN.slice(0, 3))).toEqual([]);
  });

  test("truncating the tail IS detected against an anchored head", async () => {
    const head = CHAIN[CHAIN.length - 1]!.hash;
    expect(codes(await verifyChain(CHAIN.slice(0, 3), head))).toEqual(["HEAD_MISMATCH"]);
  });
});

describe("EV-07 log half: accountable commands", () => {
  test("the fixture chain has no executed command without authority", () => {
    expect(auditAuthority(CHAIN, ENVELOPE)).toEqual([]);
  });

  test("an executed motion command with no authority is flagged", async () => {
    const { type, t, principal, cmd, applied, envelope, state_digest } = CHAIN[0]!;
    const c = await appendRecord([], { type, t, principal, authority: null, cmd, decision: "allow", applied, envelope, state_digest });
    expect(codes(auditAuthority(c, ENVELOPE))).toEqual(["NO_AUTHORITY"]);
  });

  test("an executed command with an empty principal is flagged", () => {
    const c = clone(CHAIN);
    c[0]!.principal = "";
    expect(codes(auditAuthority(c, ENVELOPE))).toEqual(["NO_PRINCIPAL"]);
  });

  test("a command without cmd.kind is treated as motion", () => {
    const c = clone(CHAIN);
    delete (c[0]!.cmd as Record<string, unknown>).kind;
    c[0]!.authority = null;
    expect(codes(auditAuthority(c, ENVELOPE))).toEqual(["NO_AUTHORITY"]);
  });

  test("a command kind the envelope does not gate is not flagged", () => {
    const env = { ...ENVELOPE, authority: { required_for: ["gripper"], resolver: "external" as const } };
    const c = clone(CHAIN).map((r) => ({ ...r, authority: null }));
    expect(auditAuthority(c, env)).toEqual([]);
  });
});

describe("replay against the envelope", () => {
  test("the fixture chain replays clean", async () => {
    expect(await replayAgainstEnvelope(CHAIN, ENVELOPE)).toEqual([]);
  });

  test("an allow that exceeded max speed is flagged", async () => {
    const c = clone(CHAIN);
    (c[0]!.applied as Record<string, number>).linear_mps = 0.8;
    expect(codes(await replayAgainstEnvelope(c, ENVELOPE))).toContain("SPEED_EXCEEDED");
  });

  test("an allow that exceeded max turn rate is flagged", async () => {
    const c = clone(CHAIN);
    (c[0]!.applied as Record<string, number>).angular_radps = -2;
    expect(codes(await replayAgainstEnvelope(c, ENVELOPE))).toContain("TURN_EXCEEDED");
  });

  test("an applied target outside keep_in is flagged", async () => {
    const c = clone(CHAIN);
    (c[0]!.applied as Record<string, unknown>).target = [6.5, 1];
    expect(codes(await replayAgainstEnvelope(c, ENVELOPE))).toContain("OUTSIDE_KEEP_IN");
  });

  test("a target exactly on the keep_in edge counts as inside", async () => {
    const c = clone(CHAIN);
    (c[0]!.applied as Record<string, unknown>).target = [6, 2];
    expect(codes(await replayAgainstEnvelope(c, ENVELOPE))).not.toContain("OUTSIDE_KEEP_IN");
  });

  test("an applied target inside a keep_out zone is flagged", async () => {
    const env = { ...ENVELOPE, workspace: { ...ENVELOPE.workspace, keep_out: [[[1, 0.5], [3, 0.5], [3, 1.5], [1, 1.5]] as [number, number][]] } };
    const c = clone(CHAIN);
    const found = codes(await replayAgainstEnvelope(c, env));
    expect(found).toContain("INSIDE_KEEP_OUT");
  });

  test("a stop that applied motion is flagged", async () => {
    const c = clone(CHAIN);
    const stop = c.find((r) => r.decision === "stop")!;
    (stop.applied as Record<string, number>).linear_mps = 0.1;
    expect(codes(await replayAgainstEnvelope(c, ENVELOPE))).toContain("STOP_WITH_MOTION");
  });

  test("a reject that applied something is flagged", async () => {
    const c = clone(CHAIN);
    const rej = c.find((r) => r.decision === "reject")!;
    rej.applied = { kind: "motion", linear_mps: 0 };
    expect(codes(await replayAgainstEnvelope(c, ENVELOPE))).toContain("REJECT_APPLIED");
  });

  test("a record decided under a different envelope is flagged", async () => {
    const tighter = { ...ENVELOPE, motion: { ...ENVELOPE.motion, max_speed_mps: 0.25 } };
    expect(codes(await replayAgainstEnvelope(CHAIN, tighter))).toContain("ENVELOPE_MISMATCH");
  });

  test("fields the replay cannot judge are reported once per name, not silently passed", async () => {
    const c = clone(CHAIN);
    (c[0]!.applied as Record<string, unknown>).joint_torque_nm = [1, 2];
    (c[1]!.applied as Record<string, unknown>).joint_torque_nm = [3, 4];
    const findings = await replayAgainstEnvelope(c, ENVELOPE);
    const unchecked = findings.filter((f) => f.code === "UNCHECKED_FIELDS");
    expect(unchecked).toEqual([
      { seq: null, code: "UNCHECKED_FIELDS", detail: "applied.joint_torque_nm is not judged by this reference replay" },
    ]);
  });
});
