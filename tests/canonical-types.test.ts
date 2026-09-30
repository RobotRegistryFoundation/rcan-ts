/**
 * Cross-SDK canonical MessageType verification (v1.10).
 *
 * This test ensures rcan-ts MessageType values match the v1.10 canonical table
 * exactly. Any drift from the spec will fail CI immediately.
 */
import { MessageType } from "../src/message";

// v1.10 canonical table — single source of truth from rcan-spec §3
const CANONICAL_TABLE: Record<string, number> = {
  COMMAND: 1,
  RESPONSE: 2,
  STATUS: 3,
  HEARTBEAT: 4,
  CONFIG: 5,
  SAFETY: 6,
  AUTH: 7,
  ERROR: 8,
  DISCOVER: 9,
  PENDING_AUTH: 10,
  INVOKE: 11,
  INVOKE_RESULT: 12,
  INVOKE_CANCEL: 13,
  REGISTRY_REGISTER: 14,
  REGISTRY_RESOLVE: 15,
  TRANSPARENCY: 16,
  COMMAND_ACK: 17,
  COMMAND_NACK: 18,
  ROBOT_REVOCATION: 19,
  CONSENT_REQUEST: 20,
  CONSENT_GRANT: 21,
  CONSENT_DENY: 22,
  FLEET_COMMAND: 23,
  SUBSCRIBE: 24,
  UNSUBSCRIBE: 25,
  FAULT_REPORT: 26,
  KEY_ROTATION: 27,
  COMMAND_COMMIT: 28,
  SENSOR_DATA: 29,
  TRAINING_CONSENT_REQUEST: 30,
  TRAINING_CONSENT_GRANT: 31,
  TRAINING_CONSENT_DENY: 32,
  CONTRIBUTE_REQUEST: 33,
  CONTRIBUTE_RESULT: 34,
  CONTRIBUTE_CANCEL: 35,
  TRAINING_DATA: 36,
  // v1.10 — Competition protocol
  COMPETITION_ENTER: 37,
  COMPETITION_SCORE: 38,
  SEASON_STANDING: 39,
  PERSONAL_RESEARCH_RESULT: 40,
  // Authority & attestation — v2.1 (41–44)
  AUTHORITY_ACCESS:           41,
  AUTHORITY_RESPONSE:         42,
  FIRMWARE_ATTESTATION:       43,
  SBOM_UPDATE:                44,
  // HiTL authorization — v3.3 (45)
  AUTHORIZE:                  45,
};

describe("v2.1 Canonical MessageType Table", () => {
  test.each(Object.entries(CANONICAL_TABLE))(
    "MessageType.%s should equal %i",
    (name, expected) => {
      const actual =
        MessageType[name as keyof typeof MessageType] as unknown as number;
      expect(actual).toBe(expected);
    }
  );

  test("should have all 45 canonical types", () => {
    for (const name of Object.keys(CANONICAL_TABLE)) {
      expect(MessageType).toHaveProperty(name);
    }
  });

  test("should not have duplicate values (v2.1 aliases removed)", () => {
    const seen = new Map<number, string>();
    for (const [name, value] of Object.entries(MessageType)) {
      if (typeof value !== "number") continue;
      if (seen.has(value)) {
        throw new Error(`Duplicate value ${value}: ${seen.get(value)} and ${name}`);
      }
      seen.set(value, name);
    }
  });

  test("FEDERATION_SYNC alias is removed in v2.1", () => {
    expect((MessageType as Record<string, unknown>)['FEDERATION_SYNC']).toBeUndefined();
  });

  test("ALERT alias is removed in v2.1", () => {
    expect((MessageType as Record<string, unknown>)['ALERT']).toBeUndefined();
  });

  test("AUDIT alias is removed in v2.1", () => {
    expect((MessageType as Record<string, unknown>)['AUDIT']).toBeUndefined();
  });
});
