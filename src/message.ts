/**
 * RCAN Message — command envelope for RCAN v1.5.
 *
 * A RCANMessage wraps a robot command with:
 * - RCAN protocol version
 * - Target Robot URI
 * - Command name and parameters
 * - Optional AI confidence score (§16)
 * - Optional model identity (§16)
 * - Optional Ed25519 signature
 * - v1.5: rcanVersion, senderType, cloudProvider, keyId, delegation chain, QoS, etc.
 */

import { RobotURI } from "./address.js";
import { SPEC_VERSION } from "./version.js";

// ── v1.5 Canonical MessageType table ─────────────────────────────────────────
// These integers MUST match rcan-py.

// ═══════════════════════════════════════════════════════════════════
// v1.10 Canonical MessageType Table
// This is the SINGLE SOURCE OF TRUTH. Values MUST match rcan-spec §3
// and rcan-py exactly. See: https://rcan.dev/spec/v1.8
// ═══════════════════════════════════════════════════════════════════
export enum MessageType {
  // Core protocol (1–8)
  COMMAND            = 1,
  RESPONSE           = 2,
  STATUS             = 3,
  HEARTBEAT          = 4,
  CONFIG             = 5,
  SAFETY             = 6,
  AUTH               = 7,
  ERROR              = 8,

  // Discovery & authorization (9–10)
  DISCOVER           = 9,
  PENDING_AUTH       = 10,

  // Skill invocation (11–13)
  INVOKE             = 11,
  INVOKE_RESULT      = 12,
  INVOKE_CANCEL      = 13,

  // Registry (14–15)
  REGISTRY_REGISTER  = 14,
  REGISTRY_RESOLVE   = 15,

  // Audit & transparency (16)
  TRANSPARENCY       = 16,  // EU AI Act Art. 13 audit record

  // Acknowledgement & QoS (17–18)
  COMMAND_ACK        = 17,
  COMMAND_NACK       = 18,

  // Identity & consent (19–22)
  ROBOT_REVOCATION   = 19,
  CONSENT_REQUEST    = 20,
  CONSENT_GRANT      = 21,
  CONSENT_DENY       = 22,

  // Fleet & telemetry (23–25)
  FLEET_COMMAND      = 23,
  SUBSCRIBE          = 24,
  UNSUBSCRIBE        = 25,

  // Diagnostics (26–28)
  FAULT_REPORT       = 26,
  KEY_ROTATION       = 27,
  COMMAND_COMMIT     = 28,

  // Sensor & training consent (29–32)
  SENSOR_DATA        = 29,
  TRAINING_CONSENT_REQUEST = 30,
  TRAINING_CONSENT_GRANT   = 31,
  TRAINING_CONSENT_DENY    = 32,

  // Idle compute contribution — v1.7 (33–35)
  CONTRIBUTE_REQUEST = 33,
  CONTRIBUTE_RESULT  = 34,
  CONTRIBUTE_CANCEL  = 35,

  // Multimodal training data — v1.8 (36)
  TRAINING_DATA      = 36,

  // ── Competition protocol — v1.10 (37–40) ─────────────────────────────────
  COMPETITION_ENTER          = 37,
  COMPETITION_SCORE          = 38,
  SEASON_STANDING            = 39,
  PERSONAL_RESEARCH_RESULT   = 40,

  // ── Authority & attestation — v2.1 (41–44) ──────────────────
  /** authority → robot: EU AI Act Art. 16(j) audit data request */
  AUTHORITY_ACCESS           = 41,
  /** robot → authority: audit data response */
  AUTHORITY_RESPONSE         = 42,
  /** robot → RRF: publish signed firmware manifest */
  FIRMWARE_ATTESTATION       = 43,
  /** robot → RRF: publish updated CycloneDX SBOM */
  SBOM_UPDATE                = 44,
  /** HiTL: approve or deny a PENDING_AUTH (spec §16.4; numbered in v3.3) */
  AUTHORIZE                  = 45,
  // FEDERATION_SYNC, ALERT, AUDIT aliases removed in v2.1
}

// ── v1.5 SenderType ───────────────────────────────────────────────────────────
/** §8.5 — Sender Type and Service Identity */
export type SenderType = "robot" | "human" | "cloud_function" | "system";

// ── v1.5 DelegationHop ────────────────────────────────────────────────────────
/** §12 — Command Delegation and Chain of Custody */
export interface DelegationHop {
  issuerRuri: string;
  humanSubject: string;
  timestamp: string;
  scope: string;
  signature: string;
}

/** RCAN v2.2: ML-DSA-65 is the only valid alg ("ml-dsa-65"). Ed25519 is deprecated. */
export interface SignatureBlock {
  alg: "ml-dsa-65";
  kid: string;
  sig: string;
}

/** v2.2: Post-quantum (ML-DSA-65) signature block */
export interface PQSignatureBlock {
  alg: "ml-dsa-65";
  kid: string;
  sig: string;
}

export interface RCANMessageData {
  rcan?: string;
  /** v1.5: explicit protocol version field (defaults to SPEC_VERSION) */
  rcanVersion?: string;
  cmd: string;
  target: string | RobotURI;
  params?: Record<string, unknown>;
  confidence?: number;
  modelIdentity?: string;
  model_identity?: string; // snake_case alias
  signature?: SignatureBlock;
  timestamp?: string;
  /** v1.5: GAP-08 sender identity */
  senderType?: SenderType;
  cloudProvider?: string;
  /** v1.5: GAP-09 key id */
  keyId?: string;
  /** v1.5: GAP-01 delegation chain */
  delegationChain?: DelegationHop[];
  /** v1.5: GAP-13 fleet group */
  groupId?: string;
  /** v1.5: GAP-11 QoS level */
  qos?: number;
  /** v1.5: GAP-19 physical presence */
  presenceVerified?: boolean;
  proximityMeters?: number;
  /** v1.5: GAP-15 observer */
  readOnly?: boolean;
  /** v1.6: GAP-14 level of assurance */
  loa?: number;
  /** v1.6: GAP-17 transport encoding hint */
  transportEncoding?: string;
  /** v1.6: GAP-18 multi-modal media chunks */
  // typed as unknown[] to avoid circular dependency with multimodal.ts
  mediaChunks?: Array<Record<string, unknown>>;
  /** v2.1: SHA-256 of sender's firmware manifest (envelope field 13). Required at L2+. */
  firmwareHash?: string;
  /** v2.1: URI to sender's SBOM attestation endpoint (envelope field 14). Required at L2+. */
  attestationRef?: string;
  /** v2.2: ML-DSA-65 post-quantum signature block (field 16, FIPS 204). Hybrid mode alongside Ed25519. */
  pqSig?: PQSignatureBlock | undefined;
  /** v2.2 snake_case envelope aliases (spec §3.2) */
  firmware_hash?: string;
  attestation_ref?: string;
  pq_sig?: string;
  pq_alg?: string;
  [key: string]: unknown;
}

export class RCANMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RCANMessageError";
  }
}

export class RCANMessage {
  readonly rcan: string;
  /** v1.5: rcanVersion field — defaults to SPEC_VERSION */
  readonly rcanVersion: string;
  readonly cmd: string;
  readonly target: string;
  readonly params: Record<string, unknown>;
  readonly confidence: number | undefined;
  readonly modelIdentity: string | undefined;
  readonly signature: SignatureBlock | undefined;
  readonly timestamp: string;
  /** v1.5 fields */
  readonly senderType: SenderType | undefined;
  readonly cloudProvider: string | undefined;
  readonly keyId: string | undefined;
  readonly delegationChain: DelegationHop[] | undefined;
  readonly groupId: string | undefined;
  readonly qos: number | undefined;
  readonly presenceVerified: boolean | undefined;
  readonly proximityMeters: number | undefined;
  readonly readOnly: boolean | undefined;
  /** v1.6: GAP-14 level of assurance */
  readonly loa: number | undefined;
  /** v1.6: GAP-17 transport encoding hint */
  readonly transportEncoding: string | undefined;
  /** v1.6: GAP-18 multi-modal media chunks */
  readonly mediaChunks: Array<Record<string, unknown>> | undefined;
  /** v2.1: SHA-256 of sender's firmware manifest */
  readonly firmwareHash: string | undefined;
  /** v2.1: URI to sender's SBOM attestation endpoint */
  readonly attestationRef: string | undefined;
  /** v2.2: ML-DSA-65 post-quantum signature (field 16, FIPS 204). Hybrid alongside Ed25519. */
  readonly pqSig: PQSignatureBlock | undefined;

  constructor(data: RCANMessageData) {
    if (!data.cmd || data.cmd.trim() === "") {
      throw new RCANMessageError("'cmd' is required");
    }
    if (!data.target) {
      throw new RCANMessageError("'target' is required");
    }

    this.rcan = data.rcan ?? SPEC_VERSION;
    this.rcanVersion = data.rcanVersion ?? SPEC_VERSION;
    this.cmd = data.cmd;
    this.target =
      data.target instanceof RobotURI ? data.target.toString() : String(data.target);
    this.params = data.params ?? {};
    this.confidence = data.confidence;
    this.modelIdentity = data.modelIdentity ?? data.model_identity;
    this.signature = data.signature;
    this.timestamp = data.timestamp ?? new Date().toISOString();
    this.senderType = data.senderType;
    this.cloudProvider = data.cloudProvider;
    this.keyId = data.keyId;
    this.delegationChain = data.delegationChain;
    this.groupId = data.groupId;
    this.qos = data.qos;
    this.presenceVerified = data.presenceVerified;
    this.proximityMeters = data.proximityMeters;
    this.readOnly = data.readOnly;
    this.loa = data.loa;
    this.transportEncoding = data.transportEncoding;
    this.mediaChunks = data.mediaChunks;
    this.firmwareHash = data.firmwareHash;
    this.attestationRef = data.attestationRef;
    this.pqSig = data.pqSig as PQSignatureBlock | undefined;

    // v2.1: hard-reject signature blocks with sig:'pending' (removed legacy pattern)
    if (
      this.signature !== undefined &&
      (this.signature as unknown as Record<string, unknown>)['sig'] === 'pending'
    ) {
      throw new RCANMessageError(
        "signature.sig:'pending' is not valid in RCAN v2.1. Sign the message before sending."
      );
    }

    if (this.confidence !== undefined) {
      if (this.confidence < 0 || this.confidence > 1) {
        throw new RCANMessageError(
          `confidence must be in [0.0, 1.0] — got ${this.confidence}`
        );
      }
    }
  }

  /** Whether this message has a signature block */
  get isSigned(): boolean {
    return this.signature !== undefined && this.signature.sig !== "";
  }

  /** Whether this message was generated by an AI model (has confidence score) */
  get isAiDriven(): boolean {
    return this.confidence !== undefined;
  }

  /** Serialize to a plain object */
  toJSON(): Record<string, unknown> {
    const obj: Record<string, unknown> = {
      rcan: this.rcan,
      rcanVersion: this.rcanVersion,
      cmd: this.cmd,
      target: this.target,
      timestamp: this.timestamp,
    };
    if (Object.keys(this.params).length > 0) obj.params = this.params;
    if (this.confidence !== undefined) obj.confidence = this.confidence;
    if (this.modelIdentity) obj.model_identity = this.modelIdentity;
    if (this.signature) obj.signature = this.signature;
    if (this.senderType !== undefined) obj.senderType = this.senderType;
    if (this.cloudProvider !== undefined) obj.cloudProvider = this.cloudProvider;
    if (this.keyId !== undefined) obj.keyId = this.keyId;
    if (this.delegationChain !== undefined) obj.delegationChain = this.delegationChain;
    if (this.groupId !== undefined) obj.groupId = this.groupId;
    if (this.qos !== undefined) obj.qos = this.qos;
    if (this.presenceVerified !== undefined) obj.presenceVerified = this.presenceVerified;
    if (this.proximityMeters !== undefined) obj.proximityMeters = this.proximityMeters;
    if (this.readOnly !== undefined) obj.readOnly = this.readOnly;
    if (this.loa !== undefined) obj.loa = this.loa;
    if (this.transportEncoding !== undefined) obj.transportEncoding = this.transportEncoding;
    if (this.mediaChunks !== undefined) obj.mediaChunks = this.mediaChunks;
    if (this.firmwareHash !== undefined) obj.firmwareHash = this.firmwareHash;
    if (this.attestationRef !== undefined) obj.attestationRef = this.attestationRef;
    return obj;
  }

  /** Serialize to JSON string */
  toJSONString(indent?: number): string {
    return JSON.stringify(this.toJSON(), null, indent);
  }

  /** Parse from a plain object or JSON string */
  static fromJSON(data: string | Record<string, unknown>): RCANMessage {
    let obj: Record<string, unknown>;
    if (typeof data === "string") {
      try {
        obj = JSON.parse(data) as Record<string, unknown>;
      } catch {
        throw new RCANMessageError("Invalid JSON string");
      }
    } else {
      obj = data;
    }

    if (!obj.cmd) throw new RCANMessageError("Missing required field: 'cmd'");
    if (!obj.target) throw new RCANMessageError("Missing required field: 'target'");
    if (!obj.rcan) throw new RCANMessageError("Missing required field: 'rcan'");

    return new RCANMessage({
      rcan: obj.rcan as string,
      rcanVersion: (obj.rcanVersion as string | undefined),
      cmd: obj.cmd as string,
      target: obj.target as string,
      params: (obj.params as Record<string, unknown>) ?? {},
      confidence: obj.confidence as number | undefined,
      modelIdentity:
        (obj.model_identity as string | undefined) ??
        (obj.modelIdentity as string | undefined),
      signature: obj.signature as SignatureBlock | undefined,
      timestamp: obj.timestamp as string | undefined,
      senderType: obj.senderType as SenderType | undefined,
      cloudProvider: obj.cloudProvider as string | undefined,
      keyId: obj.keyId as string | undefined,
      delegationChain: obj.delegationChain as DelegationHop[] | undefined,
      groupId: obj.groupId as string | undefined,
      qos: obj.qos as number | undefined,
      presenceVerified: obj.presenceVerified as boolean | undefined,
      proximityMeters: obj.proximityMeters as number | undefined,
      readOnly: obj.readOnly as boolean | undefined,
      loa: obj.loa as number | undefined,
      transportEncoding: obj.transportEncoding as string | undefined,
      mediaChunks: obj.mediaChunks as Array<Record<string, unknown>> | undefined,
      firmwareHash: obj.firmwareHash as string | undefined,
      attestationRef: obj.attestationRef as string | undefined,
      pqSig: obj.pqSig as PQSignatureBlock | undefined,
    });
  }
}

// ── v1.5 Cloud Relay helper ───────────────────────────────────────────────────

/**
 * §8.5 — Create a cloud-relay-stamped copy of a message.
 *
 * Sets senderType to "cloud_function" and records the cloud provider.
 */
export function makeCloudRelayMessage(
  base: RCANMessage,
  provider: string
): RCANMessage {
  const data = base.toJSON() as RCANMessageData;
  data.senderType = "cloud_function";
  data.cloudProvider = provider;
  return new RCANMessage(data);
}

// ── v1.5 Delegation Chain helpers ────────────────────────────────────────────

/**
 * §12 — Add a delegation hop to a message.
 */
export function addDelegationHop(
  msg: RCANMessage,
  hop: DelegationHop
): RCANMessage {
  const chain = msg.delegationChain ? [...msg.delegationChain, hop] : [hop];
  const data = msg.toJSON() as RCANMessageData;
  data.delegationChain = chain;
  return new RCANMessage(data);
}

/**
 * §12 — Validate a delegation chain (structure only; signature verification
 * requires crypto module).
 *
 * Rules:
 *  - Max depth 4 hops
 *  - Each hop must have issuerRuri, humanSubject, timestamp, scope, signature
 */
export function validateDelegationChain(
  chain: DelegationHop[]
): { valid: boolean; reason: string } {
  if (chain.length > 4) {
    return { valid: false, reason: "DELEGATION_CHAIN_EXCEEDED: max depth is 4 hops" };
  }
  for (let i = 0; i < chain.length; i++) {
    const hop = chain[i];
    if (!hop) return { valid: false, reason: `hop ${i} is undefined` };
    if (!hop.issuerRuri) return { valid: false, reason: `hop ${i}: missing issuerRuri` };
    if (!hop.humanSubject) return { valid: false, reason: `hop ${i}: missing humanSubject` };
    if (!hop.timestamp) return { valid: false, reason: `hop ${i}: missing timestamp` };
    if (!hop.scope) return { valid: false, reason: `hop ${i}: missing scope` };
    if (!hop.signature) return { valid: false, reason: `hop ${i}: missing signature` };
  }
  return { valid: true, reason: "ok" };
}

// ── v3.0: Registry Register payload (§4 — fria_ref required) ─────────────────

/** Verification tier for a robot registration. */
export type VerificationTier = 'community' | 'verified' | 'manufacturer' | 'certified';

/**
 * Payload for a REGISTRY_REGISTER message.
 * BREAKING CHANGE in RCAN v3.0: fria_ref is required.
 */
export interface RegistryRegisterPayload {
  readonly type: typeof MessageType.REGISTRY_REGISTER;
  /** Robot Registration Number */
  readonly rrn: string;
  /** Human-readable robot name */
  readonly robot_name: string;
  /** Base64url-encoded Ed25519 or ML-DSA-65 public key */
  readonly public_key: string;
  /** Robot verification tier */
  readonly verification_tier: VerificationTier;
  /** Reference URI to the submitted FRIA document. Required in RCAN v3.0. */
  readonly fria_ref: string;
  /** Arbitrary metadata key-value pairs */
  readonly metadata: Record<string, unknown>;
}

/**
 * Build a REGISTRY_REGISTER message payload.
 * fria_ref is required as of RCAN v3.0.
 */
export function makeRegistryRegister(params: {
  rrn: string;
  robot_name: string;
  public_key: string;
  verification_tier: VerificationTier;
  fria_ref: string;
  metadata?: Record<string, unknown>;
}): RegistryRegisterPayload {
  return {
    type: MessageType.REGISTRY_REGISTER,
    rrn: params.rrn,
    robot_name: params.robot_name,
    public_key: params.public_key,
    verification_tier: params.verification_tier,
    fria_ref: params.fria_ref,
    metadata: params.metadata ?? {},
  };
}
