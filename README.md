# rcan-ts

**TypeScript SDK for the [RCAN protocol](https://rcan.dev/spec/).** Build robots that communicate securely, audit every action, and enforce safety gates — in Node.js or the browser. Pinned protocol version: see the [live compatibility matrix](https://rcan.dev/compatibility).

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
import { RobotURI, RCANMessage, ConfidenceGate } from "rcan-ts";
import { ReplayCache } from "rcan-ts";
import { AuditChain } from "rcan-ts";

// 1. Address a robot
const uri = RobotURI.build({
  manufacturer: "acme",
  model: "arm",
  version: "v2",
  deviceId: "unit-001",
});
// rcan://registry.rcan.dev/acme/arm/v2/unit-001

// 2. Gate on AI confidence before acting
const gate = new ConfidenceGate(0.8);
const confidence = 0.91;

if (gate.allows(confidence)) {
  const msg = new RCANMessage({
    cmd: "move_forward",
    target: uri,
    params: { distance_m: 1.0 },
    confidence,
    modelIdentity: "gemini-2.5-flash",
  });

  // 3. Replay attack prevention
  const cache = new ReplayCache({ windowSeconds: 300 });
  if (cache.isReplay(msg.msgId)) throw new Error("Replay attack detected");
  cache.record(msg.msgId);

  // 4. ESTOP with QoS 2 (EXACTLY_ONCE) — never dropped
  const estop = new RCANMessage({
    cmd: "estop",
    target: uri,
    qos: 2, // QoSLevel.EXACTLY_ONCE
  });
}

// 5. Tamper-evident audit chain
const chain = new AuditChain("your-hmac-secret");
chain.append({
  action: "move_forward",
  robotUri: uri.toString(),
  confidence: 0.91,
  safetyApproved: true,
});
const { valid, count } = chain.verifyAll();
console.log(`Chain valid: ${valid}, ${count} records`);

// Export as JSONL for long-term storage
const jsonl = chain.toJSONL();
```

## What's in v0.6.0

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

## Protocol 66 Compliance

- **ESTOP always delivered** — send with `qos: 2` (`EXACTLY_ONCE`); never blocked
- **Local safety wins** — `OfflineMode` enforces limits without cloud connectivity
- **Confidence gates run locally** — `ConfidenceGate` makes no network calls
- **Audit chain required** — `AuditChain.verifyAll()` before executing flagged commands

## Registry Resolution

```typescript
import { NodeClient } from "rcan-ts";

const client = new NodeClient();

// Resolve an RRN across the federation
const result = await client.resolve("RRN-000000000001");
console.log(result.record.name);         // "Bob"
console.log(result.record.verification_tier); // "verified"

// Discover which node is authoritative
const node = await client.discover("RRN-BD-000000000001");
console.log(node.operator);  // "Boston Dynamics, Inc."
```

## Spec Compliance

Implements [the RCAN protocol](https://rcan.dev/compatibility) — 405 tests, 0 skipped. See the [live compatibility matrix](https://rcan.dev/compatibility) for the pinned version this SDK targets.

API surface is intentionally identical to rcan-py: `RobotURI`, `RCANMessage`, `ConfidenceGate`, `HiTLGate`, `AuditChain`, and `validateConfig` work the same way in both languages.

## Ecosystem

| Package | Version | Purpose |
|---|---|---|
| [rcan-py](https://github.com/RobotRegistryFoundation/rcan-py) | v0.6.0 | Python SDK |
| **rcan-ts** (this) | v0.6.0 | TypeScript SDK |
| [rcan-spec](https://github.com/RobotRegistryFoundation/rcan-spec) | v1.6.0 | Protocol spec |
| [ROBOT.md](https://robotmd.dev) | v0.1.0 | Single-file robot manifest |
| [OpenCastor](https://github.com/craigm26/OpenCastor) | v2026.3.17.1 | Robot runtime (reference impl) |
| [RRF](https://robotregistryfoundation.org) | v1.6.0 | Robot identity registry |
| [Fleet UI](https://app.opencastor.com) | live | Web fleet dashboard |
| [Docs](https://docs.opencastor.com) | live | Runtime reference, RCAN, API |

## Contributing

Issues and PRs welcome at [github.com/RobotRegistryFoundation/rcan-ts](https://github.com/RobotRegistryFoundation/rcan-ts).

Spec discussions: [github.com/RobotRegistryFoundation/rcan-spec/issues](https://github.com/RobotRegistryFoundation/rcan-spec/issues)

## License

MIT © Craig Merry

---

> **Stewarded by the [Robot Registry Foundation](https://github.com/RobotRegistryFoundation).** RCAN is an open standard; issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
