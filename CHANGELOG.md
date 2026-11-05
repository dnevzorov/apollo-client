# Changelog

# [2.0.0](https://github.com/dnevzorov/apollo-client/compare/v1.1.3...v2.0.0) (2026-11-05)

* feat!: support Apollo Client 4, ship ESM + CJS with exports map ([8b86839](https://github.com/dnevzorov/apollo-client/commit/8b868397ff2216e3113374740869e7b48946f1f7))

### Bug Fixes

* **deps:** lock oxlint-tsgolint 7.0.2005, 7.0.2006 is inside the CI release-age gate ([4cdefba](https://github.com/dnevzorov/apollo-client/commit/4cdefbae00d176007f49ae13288b506e2b53f5da))

### BREAKING CHANGES

* @apollo/client peer is now ^3.7.0 || ^4.0.0.
* exports map (dist/index.js ESM, dist/index.cjs CJS); no deep dist imports.
* hook option types require TVariables extends OperationVariables.
