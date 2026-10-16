# Appendix C assurance fixtures

Copied verbatim from the rcan-spec repository, branch `master`, commit
`fe35d53b2820e8533d4947ea791ce6e7fc9c10c8` (after RobotRegistryFoundation/rcan-spec#232):

| This file | rcan-spec path |
|---|---|
| `envelope-rover.valid.json` | `fixtures/envelope/rover.valid.json` |
| `envelope-tabletop-arm.valid.json` | `fixtures/envelope/tabletop-arm.valid.json` |
| `envelope-legged-recovery.valid.json` | `fixtures/envelope/legged-recovery.valid.json` |
| `envelope-estop-auto-restart.invalid.json` | `fixtures/envelope/estop-auto-restart.invalid.json` |
| `gate-decision-rover-chain.valid.json` | `fixtures/gate-decision/rover-chain.valid.json` |
| `gate-decision-legged-recovery-chain.valid.json` | `fixtures/gate-decision/legged-recovery-chain.valid.json` |

The chains' `hash`, `prev` and `envelope` values were produced by the rcan-spec
reference verifier. `tests/assurance.test.ts` recomputes them with rcan-ts, so
these files are the cross-implementation parity check. Do not edit them to make
a test pass; re-copy from rcan-spec if the spec changes.

Canonical JSON parity uses the existing `tests/fixtures/canonical-json-v1.json`,
which is byte-identical to rcan-spec's `fixtures/canonical-json-v1.json` on that
branch.

These fixtures are illustrative. They describe no real robot, and the envelope
signature is a placeholder.
