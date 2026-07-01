# Contributing

Keep connector audits local and deterministic. New policy rules should include tests that cover pass, warn, and block behavior where practical.

Before opening a PR, run:

```sh
npm test
npm run check
npm run build
npm run smoke
```
