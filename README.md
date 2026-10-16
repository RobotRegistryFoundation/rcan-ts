# rcan-ts

**TypeScript SDK for the [RCAN protocol](https://rcan.dev/spec/).** Build robots that communicate securely, audit every action, and enforce safety gates — in Node.js or the browser. Pinned protocol version: see the [live compatibility matrix](https://rcan.dev/compatibility).

Spec: [rcan.dev](https://rcan.dev) · Docs: [docs.rcan.dev](https://docs.rcan.dev) · Package: [npm `rcan-ts`](https://www.npmjs.com/package/rcan-ts)

[![npm version](https://img.shields.io/npm/v/rcan-ts.svg)](https://www.npmjs.com/package/rcan-ts)
[![RCAN Spec](https://img.shields.io/badge/RCAN-live%20matrix-blue)](https://rcan.dev/compatibility)
[![CI](https://github.com/RobotRegistryFoundation/rcan-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/RobotRegistryFoundation/rcan-ts/actions)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-18%2B-green)](https://nodejs.org)

## Where this fits in the stack

This repo is the **TypeScript SDK** layer — the library any JS/TS planner, gateway, or browser-side tool links against to speak RCAN. Everything below is independent; adopt one, or all seven.

| Layer | Piece | What it is |
|---|---|---|
| **Declaration** | [ROBOT.md](https://github.com/RobotRegistryFoundation/robot-md) | The file a robot ships at its root. YAML frontmatter + markdown prose. Spec + Python CLI. |
| **Agent bridge** | [robot-md-mcp](https://github.com/RobotRegistryFoundation/robot-md-mcp) | MCP server that exposes a `ROBOT.md` to Claude Code, Cursor, Zed, Gemini CLI — any MCP-aware agent. |
| **Wire protocol** | [RCAN](https://rcan.dev/spec/) | How robots, gateways, and planners talk. Signed envelopes, LoA enforcement, PQC crypto. Think HTTP for robots. |
| **Python SDK** | [rcan-py](https://github.com/RobotRegistryFoundation/rcan-py) | `pip install rcan` — `RCANMessage`, `RobotURI`, `ConfidenceGate`, `HiTLGate`, `AuditChain`, `RegistryClient`. |
| **TypeScript SDK** ← *this* | [rcan-ts](https://github.com/RobotRegistryFoundation/rcan-ts) | `npm install rcan-ts` — same API surface for Node + browser. |
| **Registry** | [Robot Registry Foundation](https://robotregistryfoundation.org) | Permanent RRN identities. Public resolver at `/r/<rrn>`. Like ICANN for robots. |
| **Reference runtime** | [OpenCastor](https://github.com/craigm26/OpenCastor) | Open-source robot runtime — connects LLM brains to hardware bodies. One implementation of RCAN. |

## Install

```bash
npm install rcan-ts
```

Node 18+ required (uses Web Crypto API for `transport.encodeMinimal`).

### Browser / CDN (no build step)

```html
<script src="https://unpkg.com/rcan-ts/dist/rcan.iife.js"></script>
<script>
  const uri = RCAN.RobotURI.parse('rcan://registry.rcan.dev/acme/arm/v1/unit-001');
  console.log(uri.manufacturer); // acme
</script>
```

## Quick Start

```typescript
import { RobotURI, RCANMessage, ConfidenceGate, ReplayCache, AuditChain } from "rcan-ts";

// 1. Address a robot
const uri = RobotURI.build({
  manufacturer: "acme",
  model: "arm",
  version: "v2",
  deviceId: "unit-001",
});
console.log(uri.toString()); // rcan://registry.rcan.dev/acme/arm/v2/unit-001

// 2. Gate on model confidence before acting
const gate = new ConfidenceGate(0.8);
const confidence = 0.91;
if (!gate.allows(confidence)) throw new Error("confidence below threshold");

const msg = new RCANMessage({
  cmd: "move_forward",
  target: uri,
  params: { distance_m: 1.0 },
  confidence,
});

// 3. Replay prevention: reject a message id seen inside the window
const cache = new ReplayCache(30);
const msgId = crypto.randomUUID();
console.log(cache.checkAndRecord(msgId, msg.timestamp).allowed); // true
console.log(cache.checkAndRecord(msgId, msg.timestamp).allowed); // false: replay

// 4. ESTOP with QoS 2 (EXACTLY_ONCE)
const estop = new RCANMessage({ cmd: "estop", target: uri, qos: 2 });

// 5. HMAC-chained audit log
const chain = new AuditChain("your-hmac-secret");
chain.append({
  action: "move_forward",
  robotUri: uri.toString(),
  confidence,
  safetyApproved: true,
});
const { valid, count } = chain.verifyAll();
console.log(`Chain valid: ${valid}, ${count} records`);

// Export as JSONL for long-term storage
const jsonl = chain.toJSONL();
```

`RCANMessage` does not carry a message id in rcan-ts; pass the id your transport assigns to `checkAndRecord`.

## Modules

| Module | Description |
|---|---|
| `message` | Core `RCANMessage` envelope with all v1.6 fields |
| `address` | `RobotURI` — parse, build, and validate RCAN robot addresses |
| `audit` | `AuditChain` + `CommitmentRecord` — tamper-evident HMAC-chained logs |
| `gates` | `ConfidenceGate`, `HiTLGate` — safety gates for AI-driven actions |
| `replay` | `ReplayCache` — sliding-window replay attack prevention (GAP-03) |
| `clock` | `ClockSyncStatus` — NTP clock sync verification (GAP-04) |
| `qos` | `QoSLevel` — FIRE_AND_FORGET / ACKNOWLEDGED / EXACTLY_ONCE (GAP-11) |
| `consent` | Consent wire protocol — request/grant/deny (GAP-05) |
| `revocation` | Robot identity revocation with TTL cache (GAP-02) |
| `trainingConsent` | Training data consent, GDPR/EU AI Act Annex III §5 (GAP-10) |
| `delegation` | Command delegation chain, max 4 hops, Ed25519-signed (GAP-01) |
| `offline` | Offline operation mode — ESTOP always allowed (GAP-06) |
| `faultReport` | `FaultCode` structured fault taxonomy (GAP-20) |
| `federation` | Federated consent — cross-registry trust, DNS discovery (GAP-16) |
| `transport` | Constrained transports — compact CBOR, 32-byte ESTOP minimal, BLE (GAP-17) |
| `multimodal` | Multi-modal payloads — inline/ref media, streaming (GAP-18) |
| `identity` | Level of Assurance — LoA policies, JWT parsing (GAP-14) |
| `keys` | Key rotation with JWKS-compatible `KeyStore` (GAP-09) |
| `configUpdate` | `CONFIG_UPDATE` protocol with safety scope enforcement (GAP-07) |
| `node` | `NodeClient` — resolve RRNs across federated registry nodes (§17) |
| `validate` | L1/L2/L3 conformance validation for configs, messages, URIs |
| `schema` | Canonical JSON schema validation against rcan.dev |
| `assurance` | RCAN Appendix C evidence checks: gate-decision chains, envelopes, recovery fields (informative) |

## Protocol 66 Compliance

- **ESTOP always delivered** — send with `qos: 2` (`EXACTLY_ONCE`); never blocked
- **Local safety wins** — `OfflineModeManager` enforces limits without cloud connectivity
- **Confidence gates run locally** — `ConfidenceGate` makes no network calls
- **Audit chain required** — `AuditChain.verifyAll()` before executing flagged commands

## Registry Resolution

```typescript
import { NodeClient } from "rcan-ts";

const client = new NodeClient();

// Discover which node is authoritative for an RRN
const node = await client.discover("RRN-000000000001");
console.log(node.operator); // "Robot Registry Foundation"

// Resolve an RRN across the federation
const result = await client.resolve("RRN-000000000001");
console.log(result.record.name, result.record.verification_tier);
```

`resolve()` checks the authoritative node's published public key before it
trusts a record. A node that publishes no key fails with
`RCANNodeTrustError("missing_pubkey")`; the root node's manifest is at
[rcan.dev/.well-known/rcan-node.json](https://rcan.dev/.well-known/rcan-node.json).

## Physical assurance (RCAN Appendix C, informative)

[Appendix C](https://github.com/RobotRegistryFoundation/rcan-spec/blob/master/spec/appendix-c-physical-assurance.md)
(Physical Assurance Profile) is informative. Nothing in it is required for RCAN
conformance, and nothing in this SDK calls these helpers for you.

RCAN is one open implementation of the Bounded Embodiment property; the
property and its [vendor-neutral method](https://github.com/RobotRegistryFoundation/bounded-embodiment/blob/main/method/bounded-embodiment-method-v0.1.md)
do not depend on RCAN.

rcan-ts ships the `Envelope` and `GateDecision` types (matching the
`envelope.json` and `gate-decision.json` schemas) and a port of the rcan-spec
reference verifier for `gate_decision` evidence chains:

```typescript
import {
  verifyChain, auditAuthority, replayAgainstEnvelope,
  checkEnvelopeRecovery, checkStopFields,
} from "rcan-ts";
import type { Envelope, GateDecision } from "rcan-ts";

declare const chain: GateDecision[];   // e.g. JSON.parse of a gate_decision log
declare const envelope: Envelope;      // the signed envelope in force
declare const anchoredHead: string | undefined;

const findings = [
  ...(await verifyChain(chain, anchoredHead)),       // hash links, seq, per-record hash
  ...auditAuthority(chain, envelope),                // executed gated commands carry authority
  ...(await replayAgainstEnvelope(chain, envelope)), // applied commands inside the envelope
  ...checkEnvelopeRecovery(envelope),                // stop.safe_state, recovery.*
  ...checkStopFields(chain),                         // stop_kind, reason_returned
];
// UNCHECKED_FIELDS lists fields the replay does not judge; it is not a pass.
```

Functions that hash (`envelopeHash`, `recordHash`, `appendRecord`, `verifyChain`,
`replayAgainstEnvelope`) are async because they use Web Crypto, which works the
same in Node 18+ and browsers. `auditAuthority`, `checkEnvelopeRecovery` and
`checkStopFields` are synchronous.

What these helpers do and do not tell you:

- They verify evidence, not robots. A passing chain says nothing about whether the
  machine behaved as logged.
- Without an anchored head (`expectedHead`), removing records from the end of a
  chain is not detectable.
- `checkEnvelopeRecovery` and `checkStopFields` check only the optional
  recovery fields from Appendix C.1.3 and their conditional rules: `stop_kind`
  only with `stop`, `reason_returned` never with `allow`, `estop_reset` only `manual`. They are not a full JSON Schema
  validation.
- Assurance levels BE-1 to BE-3 (`BE_LEVELS`; named A1 to A3 before
  rcan-spec #226, still exported as `ASSURANCE_LEVELS`) are independent of the
  RCAN protocol conformance levels L1 to L4. An L3 robot can be BE-1.
- An envelope's `level` is self-declared by the integrator unless third-party
  evidence accompanies it.
- Conformance is not certification.

## Spec Compliance

Implements [the RCAN protocol](https://rcan.dev/compatibility); run `npm test` for the current test count. See the [live compatibility matrix](https://rcan.dev/compatibility) for the pinned version this SDK targets.

API surface is intentionally identical to rcan-py: `RobotURI`, `RCANMessage`, `ConfidenceGate`, `HiTLGate`, `AuditChain`, and `validateConfig` work the same way in both languages.

## Ecosystem

| Package | Purpose |
|---|---|
| [rcan-py](https://github.com/RobotRegistryFoundation/rcan-py) | Python SDK, [PyPI `rcan`](https://pypi.org/project/rcan/) |
| **rcan-ts** (this) | TypeScript SDK, [npm `rcan-ts`](https://www.npmjs.com/package/rcan-ts) |
| [rcan-spec](https://github.com/RobotRegistryFoundation/rcan-spec) | Protocol spec, published at [rcan.dev](https://rcan.dev) |
| [RCAN docs](https://docs.rcan.dev) | Guides and reference |
| [ROBOT.md](https://robotmd.dev) | Single-file robot manifest |
| [OpenCastor](https://github.com/craigm26/OpenCastor) | Robot runtime, one implementation of RCAN |
| [RRF](https://robotregistryfoundation.org) | Robot identity registry |

Current versions: see the [live compatibility matrix](https://rcan.dev/compatibility).

## Contributing

Issues and PRs welcome at [github.com/RobotRegistryFoundation/rcan-ts](https://github.com/RobotRegistryFoundation/rcan-ts).

Spec discussions: [github.com/RobotRegistryFoundation/rcan-spec/issues](https://github.com/RobotRegistryFoundation/rcan-spec/issues)

## License

MIT © Craig Merry

---

> **Stewarded by the [Robot Registry Foundation](https://github.com/RobotRegistryFoundation).** RCAN is an open standard; issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
