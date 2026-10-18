# Release Candidate Notes

## Classification

Ship.

## Verification

- `npm ci`
- `npm run release:check`

The release check runs package validation, the test suite, the fixture smoke
test, SARIF 2.1.0 CLI contract checks, and the packed-tarball smoke test used
by CI. The SARIF check parses real CLI output from the action-plan and policy
fixtures and verifies its version, run, tool-rule, and result structure.

## Known Limitations

- Policy matching is exact after lowercase normalization.
- The tool cannot inspect live connector permission state.
- Approval evidence is checked as text presence, not cryptographic proof.
