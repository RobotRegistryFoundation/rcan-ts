/**
 * rcan-ts — Official TypeScript SDK for RCAN v1.6
 * Robot Communication and Accountability Network
 *
 * @see https://rcan.dev
 * @see https://github.com/RobotRegistryFoundation/rcan-ts
 */

export { RobotURI, RobotURIError } from "./address.js";
export type { RobotURIOptions } from "./address.js";

// ROBOT.md cross-link — operator brings their own YAML parser.
export {
  fromManifest,
  normalizeAgent,
  normalizeAlias,
  validateAgentRuntimes,
  validateVoiceBlock,
} from "./manifest.js";
export type {
  ManifestInfo,
  AgentRuntime,
  AgentRuntimesBlock,
  VoiceBlock,
} from "./manifest.js";

export { RCANMessage, RCANMessageError, MessageType, makeCloudRelayMessage, addDelegationHop, validateDelegationChain } from "./message.js";
export type { RCANMessageData, SignatureBlock, SenderType, DelegationHop } from "./message.js";

export { ConfidenceGate, HiTLGate, GateError } from "./gates.js";
export type { ApprovalStatus, PendingApproval } from "./gates.js";

export { CommitmentRecord, AuditChain, AuditError } from "./audit.js";
export type {
  CommitmentRecordData,
  CommitmentRecordJSON,
  ChainVerifyResult,
} from "./audit.js";

export { validateURI, validateMessage, validateConfig } from "./validate.js";
export type { ValidationResult, RCANConfig } from "./validate.js";
export type { RCANMetadata, RCANAgentConfig, RCANMessageEnvelope } from "./types.js";

export {
  RCANError,
  RCANAddressError,
  RCANValidationError,
  RCANGateError,
  RCANSignatureError,
  RCANRegistryError,
  RCANNodeError,
  RCANNodeNotFoundError,
  RCANNodeSyncError,
  RCANNodeTrustError,
  // v1.5 errors
  RCANVersionIncompatibleError,
  RCANReplayAttackError,
  RCANDelegationChainError,
  RCANConfigAuthorizationError,
} from "./errors.js";

export { RegistryClient } from "./registry.js";
export type {
  RobotRegistration,
  Robot,
  RegistrationResult,
  ListResult,
} from "./registry.js";

export { NodeClient } from "./node.js";
export type { RCANRegistryNode, RCANResolveResult } from "./types.js";

export { fetchCanonicalSchema, validateConfigAgainstSchema, validateNodeAgainstSchema } from "./schema.js";

export {
  makeEstopMessage,
  makeStopMessage,
  makeResumeMessage,
  makeTransparencyMessage,
  isSafetyMessage,
  validateSafetyMessage,
  SAFETY_MESSAGE_TYPE,
} from "./safety.js";
export type { SafetyMessage, SafetyEvent, TransparencyMessage } from "./safety.js";

// ── v1.5: version ──────────────────────────────────────────────────────────────
export { SPEC_VERSION, SDK_VERSION, validateVersionCompat } from "./version.js";

// ── v1.5: replay attack prevention (GAP-03) ────────────────────────────────────
export { ReplayCache, validateReplay } from "./replay.js";
export type { ReplayCheckResult, ReplayableMessage } from "./replay.js";

// ── v1.5: clock synchronization (GAP-04) ───────────────────────────────────────
export { checkClockSync, assertClockSynced, ClockDriftError } from "./clock.js";
export type { ClockSyncStatus } from "./clock.js";

// ── v1.5: QoS (GAP-11) ────────────────────────────────────────────────────────
export { QoSLevel, QoSManager, QoSAckTimeoutError, makeEstopWithQoS } from "./qos.js";
export type { QoSSendOptions, QoSResult } from "./qos.js";

// ── v1.5: config update (GAP-07) ──────────────────────────────────────────────
export { makeConfigUpdate, validateConfigUpdate } from "./configUpdate.js";

// ── v1.5: key rotation (GAP-09) ───────────────────────────────────────────────
export { KeyStore, makeKeyRotationMessage } from "./keys.js";
export type { JWKEntry, JWKSDocument } from "./keys.js";

// ── v1.5: consent wire (GAP-05) ───────────────────────────────────────────────
export {
  makeConsentRequest,
  makeConsentGrant,
  makeConsentDeny,
  validateConsentMessage,
} from "./consent.js";
export type { ConsentType, ConsentRequestParams, ConsentResponseParams } from "./consent.js";

// ── v1.5: revocation (GAP-02) ─────────────────────────────────────────────────
export {
  RevocationCache,
  checkRevocation,
  makeRevocationBroadcast,
} from "./revocation.js";
export type { RevocationStatus, RevocationStatusValue } from "./revocation.js";

// ── v1.5: training data consent (GAP-10) ──────────────────────────────────────
export {
  DataCategory,
  makeTrainingConsentRequest,
  makeTrainingConsentGrant,
  makeTrainingConsentDeny,
  validateTrainingDataMessage,
} from "./trainingConsent.js";
export type { TrainingConsentRequestParams } from "./trainingConsent.js";

// ── v1.5: offline mode (GAP-06) ───────────────────────────────────────────────
export { OfflineModeManager } from "./offline.js";
export type { OfflineState, OfflineCommandResult, CachedKey } from "./offline.js";

// ── v1.5: fault reporting (GAP-20) ────────────────────────────────────────────
export { FaultCode, makeFaultReport } from "./faultReport.js";
export type { FaultSeverity, FaultReportParams, AuditExportRequest } from "./faultReport.js";

// ── v1.6 / v2.1: identity, roles & LoA (§2 RBAC) ─────────────────────────────
export {
  Role,
  LevelOfAssurance,           // backward-compat alias for Role
  ROLE_JWT_LEVEL,
  SCOPE_MIN_ROLE,
  roleFromJwtLevel,
  DEFAULT_LOA_POLICY,
  PRODUCTION_LOA_POLICY,
  extractRoleFromJwt,
  extractLoaFromJwt,          // backward-compat alias
  extractIdentityFromJwt,
  validateRoleForScope,
  validateLoaForScope,
} from "./identity.js";
export type { LoaPolicy, IdentityRecord, ScopeValidationResult } from "./identity.js";

// ── v1.6: federation (GAP-16) ─────────────────────────────────────────────────
export {
  RegistryTier,
  FederationSyncType,
  TrustAnchorCache,
  makeFederationSync,
  validateCrossRegistryCommand,
} from "./federation.js";
export type { RegistryIdentity, FederationSyncPayload } from "./federation.js";

// ── v1.6: transport encodings (GAP-17) ────────────────────────────────────────
export {
  TransportEncoding,
  TransportError,
  encodeCompact,
  decodeCompact,
  encodeMinimal,
  decodeMinimal,
  encodeBleFrames,
  decodeBleFrames,
  selectTransport,
} from "./transport.js";

// ── v1.6: multi-modal data (GAP-18) ───────────────────────────────────────────
export {
  MediaEncoding,
  addMediaInline,
  addMediaRef,
  validateMediaChunks,
  makeTrainingDataMessage,
  makeStreamChunk,
} from "./multimodal.js";
export type { MediaChunk, StreamChunk } from "./multimodal.js";

export const VERSION = "0.6.0";
/** @deprecated Use SPEC_VERSION from ./version instead */
export const RCAN_VERSION = "1.6";

export { makeContributeRequest, makeContributeResult, makeContributeCancel, validateContributeScope, isPreemptedBy, CONTRIBUTE_SCOPE_LEVEL } from "./contribute";
export type { ContributeRequest, ContributeResult, ContributeCancel, WorkUnitStatus, ComputeResource } from "./contribute";

// ── v1.10: competition protocol ────────────────────────────────────────────────
export {
  COMPETITION_SCOPE_LEVEL,
  makeCompetitionEnter,
  makeCompetitionScore,
  makeSeasonStanding,
  makePersonalResearchResult,
  validateCompetitionScope,
} from "./competition.js";
export type {
  CompetitionFormat,
  CompetitionBadge,
  RunType,
  StandingEntry,
  ResearchMetrics,
  CompetitionEnter,
  CompetitionScore,
  SeasonStanding,
  PersonalResearchResult,
} from "./competition.js";

// ── v2.1: Firmware Manifests (§11) ───────────────────────────────────────────
export {
  FIRMWARE_MANIFEST_PATH,
  FirmwareIntegrityError,
  manifestToWire,
  manifestFromWire,
  canonicalManifestJson,
  validateManifest,
} from "./firmware.js";
export type {
  FirmwareComponent,
  FirmwareManifest,
  FirmwareManifestWire,
} from "./firmware.js";

// ── v2.1: Authority Access (§13 / EU AI Act §16) ────────────────────────────
export {
  AUTHORITY_ERROR_CODES,
  authorityAccessToWire,
  authorityAccessFromWire,
  validateAuthorityAccess,
  isAuthorityRequestValid,
} from "./authority.js";
export type {
  AuthorityDataCategory,
  AuthorityAccessPayload,
  AuthorityAccessPayloadWire,
  AuthorityResponsePayload,
  AuthorityResponseData,
} from "./authority.js";

// ── v2.1: M2M Authorization (§2.8–§2.9) ────────────────────────────────────
export {
  M2MAuthError,
  M2M_TRUSTED_ISSUER,
  RRF_REVOCATION_URL,
  RRF_REVOCATION_CACHE_TTL_MS,
  parseM2mPeerToken,
  parseM2mTrustedToken,
  verifyM2mTrustedTokenClaims,
  verifyM2mTrustedToken,
  isM2mTrustedRevoked,
  fetchRRFRevocations,
} from "./m2m.js";
export type { M2MPeerClaims, M2MTrustedClaims } from "./m2m.js";

// v2.2: ML-DSA-65 signing (FIPS 204) — Ed25519 deprecated
export { MLDSAKeyPair, signMessage, verifyMessage, addPQSignature, verifyPQSignature } from "./pqSigning.js";
export type { MLDSAKeyPairData } from "./pqSigning.js";

// v2.2: ML-DSA-65 PQC primitives + hybrid Ed25519+ML-DSA-65 (issue #40)
export {
  generateMlDsaKeypair,
  signMlDsa,
  verifyMlDsa,
  signHybrid,
  verifyHybrid,
  encodeHybridSig,
  decodeHybridSig,
  encodeMlDsaPublicKeyJwk,
  decodeMlDsaPublicKeyJwk,
} from "./crypto.js";
export type { MlDsaKeyPair, HybridSignature } from "./crypto.js";

export * from './mcp';

// ── v2.2: Delegation and media envelope types ────────────────────────────────
export type { V22DelegationHop, V22MediaChunk } from './delegation.js';
export { validateV22DelegationChain, verifyV22MediaChunkHash } from './delegation.js';

export { computeWatermarkToken, verifyTokenFormat, verifyViaApi } from "./watermark.js";

// ── v3.0: Compliance schema types + builders + constants (§22–§26) ───────────
export {
  // §22 FRIA types
  type FriaSigningKey,
  type FriaConformance,
  type FriaDocument,
  // §23-26 wire-format types
  type SafetyBenchmark,
  type InstructionsForUse,
  type IncidentSeverity,
  type PostMarketIncidentReport,
  type EuRegisterEntry,
  // §23-26 schema identifiers
  SAFETY_BENCHMARK_SCHEMA,
  IFU_SCHEMA,
  INCIDENT_REPORT_SCHEMA,
  EU_REGISTER_SCHEMA,
  // §23-26 spec-domain constants
  ART13_COVERAGE,
  VALID_SEVERITIES,
  REPORTING_DEADLINES,
  ART72_NOTE,
  CONFORMITY_STATUS_DECLARED,
  SUBMISSION_INSTRUCTIONS,
  // §23-26 builders
  buildSafetyBenchmark,
  buildIfu,
  buildIncidentReport,
  buildEuRegisterEntry,
} from './compliance.js';

// ── v3.0: RegistryRegisterPayload + makeRegistryRegister ─────────────────────
export type { RegistryRegisterPayload, VerificationTier } from './message.js';
export { makeRegistryRegister } from './message.js';

// ── v3.1 consolidation — canonical JSON + dict-level hybrid signing ──────────
export { canonicalJson } from "./encoding.js";
export { signBody, verifyBody } from "./hybrid.js";
export type { SignBodyOptions } from "./hybrid.js";
