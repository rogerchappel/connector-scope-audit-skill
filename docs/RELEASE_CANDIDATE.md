# Release Candidate Notes

## Classification

Ship.

## Verification

- `npm ci`
- `npm run release:check`

The release check runs package validation, the test suite, the fixture smoke
test, and the packed-tarball smoke test used by CI.

## Known Limitations

- Policy matching is exact after lowercase normalization.
- The tool cannot inspect live connector permission state.
- Approval evidence is checked as text presence, not cryptographic proof.
