# CLAUDE.md — rcan-ts Development Guide

> **Agent context file.** Read this before making any changes.

## What Is rcan-ts?

`rcan-ts` is the official TypeScript SDK for the RCAN robot communication protocol. It provides:
- `RCANMessage` — create, validate, and serialize RCAN messages
- `RobotURI` — parse and validate `rcan://` URIs
- `MessageType` enum — all 35+ RCAN message type codes
- `validateLoaForScope()` — Level of Assurance policy enforcement
- Federation, consent, multimodal, replay, and delegation support

**Version**: 0.8.0 | **Spec**: see [rcan.dev/compatibility](https://rcan.dev/compatibility) | **Runtime**: Node.js 18+ | **Tests**: 447 passing

## Repository Layout

```
rcan-ts/
├── src/
│   ├── message.ts      # RCANMessage class, MessageType enum, validation
│   ├── identity.ts     # LevelOfAssurance, LoaPolicy, validateLoaForScope
│   ├── version.ts      # SPEC_VERSION = "3.2", SDK_VERSION = "3.4.2"
│   ├── uri.ts          # RobotURI — parse/validate rcan:// URIs
│   ├── federation.ts   # Federation sync and peer validation
│   ├── consent.ts      # Cross-robot consent protocol
│   ├── multimodal.ts   # Multimodal message support
│   ├── replay.ts       # Replay protection
│   └── index.ts        # Public exports
├── tests/
│   ├── message.test.ts    # Message creation, validation, MessageType values
│   ├── identity.test.ts   # LoA enforcement, scope validation
│   ├── federation.test.ts # Federation protocol tests
│   └── ...                # 25 test suites
├── package.json        # name: "rcan-ts", version: "3.4.2"
└── tsconfig.json
```

## Key Constants

```typescript
import { MessageType, SPEC_VERSION, SDK_VERSION } from 'rcan-ts';

SPEC_VERSION  // "3.2" — tracks current stable spec version
SDK_VERSION   // "3.4.2"
```

The published npm package is `rcan-ts` (NOT `@continuonai/rcan`, which 404s).

## Running Tests

```bash
npm install
npm test        # 409 tests across 25 suites
```

## MessageType Enum

Integers MUST match rcan-py. Current range: 1–35.

Notable v1.7 additions:
- `CONTRIBUTE_REQUEST = 33` — coordinator → robot: deliver work unit
- `CONTRIBUTE_RESULT = 34` — robot → coordinator: return results
- `CONTRIBUTE_CANCEL = 35` — robot → coordinator: cancellation notice

## Scope Validation

`validateLoaForScope()` maps scope names to LoA requirements:
- `discover`, `status` → `minLoaDiscover` / `minLoaStatus`
- `chat`, `contribute` → `minLoaChat` (contribute is between chat and control)
- `control` → `minLoaControl`
- `safety` → `minLoaSafety`

## Code Style

- Strict TypeScript — no `any` in public APIs
- All exports from `src/index.ts`
- Tests use Jest with ts-jest
- No runtime dependencies beyond built-in Node.js modules
