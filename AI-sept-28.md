# Sumcoin Explorer API Work — September 28, 2026

## Purpose

This file records the production Sumcoin Insight API changes identified and prepared for upstreaming on September 28, 2026.

Production explorer:

`/root/explorer/sumcoin-explorer`

Live package:

`/root/explorer/sumcoin-explorer/node_modules/insight-sum-api`

Installed version:

`0.4.6`

Branch:

`explorer-updates-2026`

Pull request:

`sumcoinlabs/insight-sum-api#4`

## Audit method

A clean clone of `sumcoinlabs/insight-sum-api` was compared against the package actually running on the production explorer.

The audit separated real source changes from npm/package artifacts.

Only three meaningful API source files differed:

- `lib/currency.js`
- `lib/status.js`
- `lib/transactions.js`

## Currency API

File:

`lib/currency.js`

The old implementation used a single rates endpoint and primarily returned the USD rate.

The production implementation adds a substantially more complete currency system.

Primary source:

`https://rates.slicewallet.org/api/rates`

Secondary fiat fallback:

`https://open.er-api.com/v6/latest/USD`

Behavior includes:

- normalize currency rate objects
- maintain a complete rates array
- preserve the existing `bitstamp` response field for compatibility
- put USD first
- sort other currencies by code
- fill selected missing currencies using the fallback FX API
- currently supplements CRC and MXN when necessary
- cache rate data
- default refresh period remains 10 minutes
- return cached values if a subsequent rate refresh fails
- report whether fallback FX data was used
- report the fallback FX update time
- return HTTP 502 only when no valid cached data is available and the primary source fails

This backend supports the expanded production currency selector and display in `insight-sum-ui`.

## Status API

File:

`lib/status.js`

The production API obtains the actual Sumcoin peer count using:

`getconnectioncount`

through `sumcoin-cli`.

Important:

`var cli = '/root/sumcoin/src/sumcoin-cli';`

is INTENTIONAL for this deployment.

Do not automatically replace or generalize that path unless the deployment itself is being changed.

When `service.spawn.exec` exists, the code can derive a sibling `sumcoin-cli` executable from the configured daemon path.

When a datadir is available, the CLI receives that datadir.

If the CLI call fails, the API falls back to the connection count reported by the bitcoind service.

The sync status label was also changed from:

`bitcore node`

to:

`sumcore node`

## Proof-of-Stake transaction API

File:

`lib/transactions.js`

The API now understands the coinstake information supplied by `bitcore-node-sumcoin`.

For a coinstake transaction it exposes:

`isCoinStake = true`

and:

`stakeReward = transaction.stakeRewardSatoshis / 1e6`

and reports:

`fees = 0`

A staking reward is newly minted SUM and must not be displayed as a negative transaction fee.

Normal non-coinstake transaction fee handling remains unchanged.

## Dependency

The underlying coinstake fields are produced by:

`sumcoinlabs/bitcore-node-sumcoin#1`

That PR adds:

`tx.coinstake`

and:

`tx.stakeRewardSatoshis`

Preferred merge order:

1. `bitcore-node-sumcoin#1`
2. `insight-sum-api#4`
3. `insight-sum-ui` production synchronization

## Files intentionally NOT copied

The npm-installed `package.json` was not copied because its differences are package/install metadata rather than the intended source changes.

Repository-only files including:

- `.gitignore`
- `.npmignore`
- `yarn.lock`

were not changed.

## Validation

Before creating the PR the following passed:

`git diff --check`

`node --check lib/status.js`

`node --check lib/currency.js`

`node --check lib/transactions.js`

The original code PR contained exactly three source files.

## UI work still to upstream

The production `insight-sum-ui` has a much larger set of changes.

The audit identified work involving:

- homepage latest transactions and blocks
- status display
- expanded currency support
- transaction/coinstake presentation
- address payment UX
- incoming payment notification
- successful payment notification
- payment audio
- sound enable/disable control
- branding and icons
- CSS/layout improvements
- Spanish pages
- search/scanner/navigation changes
- API documentation pages
- SEO and sitemap work

Care is required when preparing that PR because the production package also contains generated files such as:

- `public/js/main.js`
- `public/js/main.min.js`
- `public/css/main.css`
- `public/css/main.min.css`

as well as runtime/generated SEO files.

Source files, intentional static assets and generated runtime artifacts should be separated before upstreaming.
