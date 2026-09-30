# Appendix C assurance fixtures

Copied verbatim from the rcan-spec repository, branch `align/bounded-embodiment`
(RobotRegistryFoundation/rcan-spec#221, not yet merged), commit
`34ad1caa988ef16db5b54499377e88c0eb5327b1`:

| This file | rcan-spec path |
|---|---|
| `envelope-rover.valid.json` | `fixtures/envelope/rover.valid.json` |
| `envelope-tabletop-arm.valid.json` | `fixtures/envelope/tabletop-arm.valid.json` |
| `gate-decision-rover-chain.valid.json` | `fixtures/gate-decision/rover-chain.valid.json` |

The chain's `hash`, `prev` and `envelope` values were produced by the rcan-spec
reference verifier. `tests/assurance.test.ts` recomputes them with rcan-ts, so
these files are the cross-implementation parity check. Do not edit them to make
a test pass; re-copy from rcan-spec if the spec changes.

Canonical JSON parity uses the existing `tests/fixtures/canonical-json-v1.json`,
which is byte-identical to rcan-spec's `fixtures/canonical-json-v1.json` on that
branch.

These fixtures are illustrative. They describe no real robot, and the envelope
signature is a placeholder.
