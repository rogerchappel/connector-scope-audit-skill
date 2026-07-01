# Release Candidate Notes

## Classification

Ship.

## Verification

- `npm test`
- `npm run check`
- `npm run build`
- `npm run smoke`

## Known Limitations

- Policy matching is exact after lowercase normalization.
- The tool cannot inspect live connector permission state.
- Approval evidence is checked as text presence, not cryptographic proof.
