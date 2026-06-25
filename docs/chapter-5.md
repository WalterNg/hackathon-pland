# Chapter 5: On-Chain Portfolio Achievement Certification System

**Feature Area:** Blockchain & Gamification  
**Created:** 2026-06-19  
**Status:** Partially Implemented — Sections 5.1–5.5 complete; Sections 5.6–5.8 planned  

---

## 5.1 Introduction and Motivation

Modern portfolio management applications typically provide performance metrics and historical snapshots as visual dashboards. However, these representations suffer from a fundamental trust deficit: any chart, figure, or screenshot can be fabricated post-hoc without any independently verifiable proof of the underlying data. This limitation is particularly consequential in contexts involving investor due diligence, social credibility, or competitive benchmarking.

This chapter describes the design and implementation of PLAND's On-Chain Portfolio Achievement Certification System — a feature that addresses the trust deficit by anchoring portfolio milestone events to the Ethereum blockchain through Soulbound Non-Fungible Tokens (NFTs). The system serves two complementary objectives:

1. **Gamification**: Users earn badge NFTs upon reaching portfolio milestones (e.g., reaching $10,000 in total value, maintaining a Sharpe ratio above 1.0), creating an incentive structure that rewards disciplined investment behavior.

2. **Verifiable Certification**: Each badge NFT encodes a cryptographic hash of the portfolio snapshot at the time of achievement. This hash constitutes an immutable, independently auditable proof of portfolio state that cannot be retroactively altered.

The design deliberately separates the *proof mechanism* (NFT on-chain) from the *data storage* (authenticated server), striking a balance between verifiability and user privacy.

---

## 5.2 System Architecture Overview

The certification system is composed of five layers, each with clearly defined responsibilities:

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| Blockchain | ERC-721 Soulbound Contract | Immutable ownership record, on-chain snapshot hash |
| Asset | IPFS via Pinata | Badge images and achievement metadata (public, immutable) |
| Backend | FastAPI services | Achievement evaluation, NFT minting orchestration, cert storage |
| Database | PostgreSQL (Supabase) | Portfolio snapshots, certificates, achievement unlocks |
| Frontend | Next.js | Milestone timeline, badge collection display, verification UI |

The system is designed around the following invariant: **no portfolio data is ever stored on-chain in plaintext**. Only the SHA-256 hash of the canonicalized snapshot payload is committed to the blockchain, embedded as an attribute in the NFT metadata. Full portfolio details remain in the authenticated backend and are accessible exclusively to the portfolio owner.

---

## 5.3 Blockchain Layer — Smart Contract Design

### 5.3.1 Contract Specification

The smart contract `PlandAchievementBadge` is implemented as an ERC-721 Non-Fungible Token with the ERC-5192 Soulbound extension. The Soulbound property prevents token transfer between wallets, which is semantically appropriate for achievement badges: an achievement cannot be sold or delegated, as it reflects the investment behavior of a specific portfolio.

**Contract address:** `0xC4369cF2836b70A76255605b9f0EC16279F14aA5`  
**Network:** Ethereum Sepolia Testnet  
**Verification:** Etherscan, Blockscout, Sourcify  

Key design choices:

- **Platform wallet minting**: In the current phase, all NFTs are minted to the platform wallet rather than directly to individual user wallets. This eliminates the requirement for users to hold ETH or interact with a wallet extension during normal application usage. A Phase 2 export mechanism is planned to allow users to claim tokens to their own wallets.

- **ERC-5192 compliance**: The contract implements the `locked(tokenId)` function returning `true` for all tokens, signaling to marketplaces and wallets that these tokens are non-transferable.

- **tokenURI**: Each minted token carries a `tokenURI` that resolves to the badge's metadata document. The current implementation points to static JSON files hosted on IPFS. Section 5.6 describes the planned transition to a dynamic, server-side metadata endpoint.

### 5.3.2 Minting Flow

Minting is performed by the platform backend using the platform wallet's private key stored in environment configuration. The minting sequence is as follows:

1. The achievement evaluation engine determines that a portfolio has met one or more achievement criteria.
2. A certificate record is created in the database with `nft_mint_status = "pending_mint"`.
3. The `NftMintService` constructs and broadcasts a `safeMint(to, tokenURI)` transaction to the Sepolia network.
4. Upon transaction confirmation, the certificate record is updated with `token_id`, `contract_address`, and `tx_hash`.
5. Any minting failure is recorded as `nft_mint_status = "failed"` and logged as non-fatal — the achievement certificate remains valid regardless of minting outcome.

---

## 5.4 Badge Asset Pipeline

### 5.4.1 Achievement Taxonomy

The system defines ten achievement keys across four categories. Each category follows a tiered progression (Bronze → Silver → Gold), where higher tiers imply the satisfaction of all lower-tier criteria within the same metric.

| Key | Nickname | Tier | Metric | Threshold |
|-----|----------|------|--------|-----------|
| `diversified_5_assets` | Seed Sower | Bronze | distinct_assets ≥ | 5 |
| `diversified_10_assets` | Portfolio Gardener | Silver | distinct_assets ≥ | 10 |
| `diversified_20_assets` | Allocation Master | Gold | distinct_assets ≥ | 20 |
| `rich_10k` | 10K Club | Bronze | total_value_usd ≥ | $10,000 |
| `rich_50k` | 50K Whale | Silver | total_value_usd ≥ | $50,000 |
| `rich_100k` | 100K Whale | Gold | total_value_usd ≥ | $100,000 |
| `drawdown_guard_10` | Capital Keeper | Bronze | max_drawdown_percent ≤ | 10% |
| `drawdown_guard_5` | Capital Guardian | Silver | max_drawdown_percent ≤ | 5% |
| `sharpe_1_0` | Sharpe Hunter | Bronze | sharpe_ratio_30d ≥ | 1.0 |
| `sharpe_2_0` | Risk-Adjusted Legend | Silver | sharpe_ratio_30d ≥ | 2.0 |

### 5.4.2 Badge Visual Design

Badge images follow a consistent visual language: a flat 2D hexagonal form (point-top orientation) with concentric ring detailing, a floating top accent dot, and a tier-specific color palette. Images are 512×512px PNG files generated via generative image tooling and are considered immutable once published.

Tier palettes:
- **Bronze**: warm brown tones (#5a3a1a → amber → tan)
- **Silver**: cool blue-gray (#3a3d52 → #696c88 → #a8abc2)
- **Gold**: warm yellow (#5a4a00 → #c8a020 → #f0d060)

### 5.4.3 IPFS Hosting

Badge images are hosted in a Pinata-managed IPFS folder (`bafybeih64xr5ymvnjb6c2pbvohldvit22d2snufeojizeexbch4gutxsii`). A corresponding folder of OpenSea-compatible JSON metadata documents is hosted separately (`bafybeifctpcjbfp5qj2aqav67mvsywycifqvkgapgj2czpjhs2lkpjxxgi`). Each JSON document conforms to the OpenSea metadata standard:

```json
{
  "name": "Diversification I",
  "description": "Hold at least five distinct assets...",
  "image": "ipfs://<IMAGE_CID>/diversified_5_assets.png",
  "attributes": [
    { "trait_type": "Category", "value": "Diversification" },
    { "trait_type": "Tier", "value": "Bronze" },
    { "trait_type": "Metric", "value": "distinct_assets" },
    { "trait_type": "Threshold", "value": "5" },
    { "trait_type": "Chain", "value": "Ethereum Sepolia" },
    { "trait_type": "Type", "value": "Soulbound" }
  ]
}
```

**Note:** The current metadata does not yet include `snapshot_hash` or `external_url`. These fields will be added as part of the dynamic metadata endpoint described in Section 5.6.

---

## 5.5 Achievement Evaluation and Certification Backend

### 5.5.1 Evaluation Engine

The `PortfolioAchievementEvaluator` evaluates a portfolio snapshot payload against all active achievement definitions. For each definition, the evaluator extracts the relevant metric from the snapshot and applies the configured operator (`gte` or `lte`) against the threshold. Metrics supported include `distinct_assets`, `total_value_usd`, `max_drawdown_percent`, and `sharpe_ratio_30d`.

The evaluator returns all matching definitions alongside their observed metric values. Importantly, the tiered structure of achievements means that satisfying a Silver-tier criterion (e.g., 10 distinct assets) also implicitly satisfies Bronze-tier (5 distinct assets). The evaluation engine handles this correctly by evaluating all definitions independently rather than by tier.

### 5.5.2 Auto-Certification Flow

Auto-certification is triggered each time a fresh portfolio snapshot is fetched by the frontend. The `auto_certify_achievements` routine:

1. Fetches all active achievement definitions from the database.
2. Evaluates the current snapshot against all definitions.
3. For each matched definition, checks whether an unlock record already exists for the user/portfolio pair.
4. If not previously unlocked, creates a `portfolio_snapshot_certificates` record with `certify_mode = "auto_achievement"`.
5. Initiates non-blocking NFT minting for the certificate.
6. Creates a `portfolio_achievement_unlocks` record linking the unlock to the certificate.

### 5.5.3 Concurrency and Idempotency

A race condition was identified where concurrent snapshot fetch requests could trigger simultaneous auto-certification calls, potentially resulting in duplicate certificates or unlock records for the same achievement. This was mitigated through:

1. A unique partial index on `portfolio_achievement_unlocks(user_id, portfolio_id, achievement_key)`, which enforces at most one unlock per achievement per portfolio at the database level.
2. Wrapping both the certificate creation and unlock insertion in independent `try/except` blocks with graceful degradation, so that a concurrency-induced constraint violation on either operation results in a silent skip rather than a request failure.

### 5.5.4 Known Issue: Non-Atomic Cert/Unlock Insertion

The original implementation exposed a subtle non-atomicity bug: if certificate creation succeeded but the subsequent unlock insertion failed (e.g., due to a transient network error or connection timeout), the resulting "orphan certificate" — a cert record with no corresponding unlock — would permanently block future certify attempts for that achievement. This occurred because the unique constraint on `portfolio_snapshot_certificates(user_id, portfolio_id, achievement_key)` would reject the retry, and the catch block would silently skip the unlock creation.

The resolution involved two changes:

1. **Dropping the unique constraint** on `portfolio_snapshot_certificates` for `achievement_key`, so that a retry is always able to create a new certificate and proceeds to unlock insertion.
2. **Isolating the unlock insertion** in its own `try/except` block, so that a race-condition failure on unlock does not surface as an unhandled exception.

The `portfolio_achievement_unlocks` unique index remains as the sole deduplication guard, which is semantically correct: it is the unlock record, not the certificate, that represents the canonical "earned" state of an achievement.

---

## 5.6 NFT Metadata Endpoint (Planned)

### 5.6.1 Motivation

The current tokenURI implementation points to static IPFS-hosted JSON files. While this satisfies basic OpenSea display requirements, it has two significant limitations:

1. **No portfolio state commitment**: The metadata does not include `snapshot_hash`, meaning the NFT badge carries no cryptographic reference to the portfolio state at the time of earning. The badge proves the achievement category but not the specific portfolio event.

2. **No dynamic per-cert data**: Manual certification (described in Section 5.7) cannot be supported with static IPFS metadata, as each certificate requires a unique `snapshot_hash` in its metadata.

### 5.6.2 Proposed Design

A server-side metadata endpoint will replace static IPFS tokenURIs for all certificates:

```
GET /api/nft/certificate/{cert_id}
```

The endpoint implements two-level access control:

**Level 1 — Public (no authentication required):**
Returns OpenSea-compatible metadata sufficient for display in MetaMask, Etherscan, and OpenSea:

```json
{
  "name": "Seed Sower",
  "description": "Hold at least five distinct assets...",
  "image": "ipfs://<IMAGE_CID>/diversified_5_assets.png",
  "external_url": "https://pland.io/verify?hash={snapshot_hash}",
  "attributes": [
    { "trait_type": "Category", "value": "Diversification" },
    { "trait_type": "Tier", "value": "Bronze" },
    { "trait_type": "Snapshot Hash", "value": "{snapshot_hash}" },
    { "trait_type": "Certified At", "value": "2026-06-19" }
  ]
}
```

The inclusion of `snapshot_hash` as an attribute constitutes the on-chain commitment to portfolio state without exposing any sensitive holdings data.

**Level 2 — Authenticated (PLAND user session required):**
Returns the full response above, augmented with the complete portfolio state:

```json
{
  ...
  "portfolioState": {
    "totalValueUsd": 12400.50,
    "assets": [...],
    "metrics": { "sharpeRatio30d": 1.23, "maxDrawdownPercent": 8.4 }
  }
}
```

### 5.6.3 Implications for Manual Certificates

Manual certificates (user-initiated snapshots, `certify_mode = "manual"`) will also be minted as NFTs using this dynamic tokenURI approach. A generic "Certified Portfolio Snapshot" badge with a purple visual identity will be used for manual certs, as they carry no predefined achievement category.

Anchor hash transactions — previously used to write snapshot hashes to the blockchain via self-transfer transactions — will be deprecated entirely. The `snapshot_hash` attribute in the NFT metadata supersedes this mechanism, as it is more semantically meaningful (an NFT constitutes a verifiable digital asset, whereas a self-transfer transaction is merely a timestamped data payload).

---

## 5.7 Portfolio Verification System (Planned)

### 5.7.1 Overview

The verification system enables independent third-party auditing of portfolio state claims without requiring the auditor to be a PLAND account holder. This addresses the core trust problem: any party in possession of a snapshot hash — obtained from an NFT on Etherscan or OpenSea — can verify the authenticity of the corresponding portfolio claim.

### 5.7.2 Verification Flow

```
Auditor obtains snapshot_hash from NFT attributes on Etherscan/OpenSea
    ↓
Navigates to pland.io/verify?hash={snapshot_hash}
    ↓
[Public view]  "✓ Verified on-chain | Token #123 | 2026-06-19"
[PLAND user]   + full portfolio state (assets, values, metrics)
```

The public view deliberately provides no portfolio holdings details. It confirms only that:
- The hash was committed to the blockchain at a specific timestamp via NFT mint.
- The hash is associated with a valid PLAND certificate record.

This design satisfies the audit requirement — the hash proves the portfolio state existed and was committed to the blockchain — without compromising user privacy. A PLAND user who wishes to share full portfolio details may choose to do so by granting access within the application, but this is not a prerequisite for third-party verification.

### 5.7.3 Verification Page Behavior

The verification page is a public, unauthenticated route (`/verify`) that accepts a `hash` query parameter. It opens in a new browser tab to avoid interrupting the authenticated session of a user currently using the application.

---

## 5.8 AI Storytelling Engine (Planned)

### 5.8.1 Overview

The AI Storytelling feature synthesizes a user's achievement history into a human-readable narrative, drawing exclusively from on-chain data to ensure verifiability. The system reads the user's NFT list from the blockchain, verifies each token's snapshot hash against the backend, and generates a narrative using a language model.

### 5.8.2 Output Modes

Two output modes are planned:

**Share Mode**: A chronological prose narrative of the user's investment journey, suitable for publishing on social media. The narrative highlights key milestones (first diversification, first wealth threshold, sustained risk management) in a conversational tone.

> *"Starting with just three assets in early 2026, you steadily expanded your portfolio to ten distinct holdings — earning the Portfolio Gardener badge along the way. By June, disciplined risk management held your maximum drawdown below 10%, cementing your Capital Keeper status..."*

**Audit Mode**: A structured report with on-chain proof references, suitable for investor due diligence. The report includes milestone timestamps, achievement criteria, observed metric values, and Etherscan links to the corresponding NFT mint transactions.

### 5.8.3 Data Source and Trust Model

The storytelling engine reads NFT data from the blockchain rather than from the PLAND database. This design choice ensures that the narrative is grounded in independently verifiable facts: if the story claims a milestone was reached on a specific date, the corresponding NFT mint transaction can be inspected on any public Ethereum block explorer to confirm the claim.

---

## 5.9 Summary of Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| ERC-721 Soulbound contract | ✅ Complete | Deployed, verified on Sepolia |
| Badge images (IPFS) | ✅ Complete | 10 achievement keys |
| JSON metadata (IPFS) | ✅ Complete | Static, no snapshot_hash yet |
| NFT mint service | ✅ Complete | Non-blocking, failure-tolerant |
| Achievement evaluation engine | ✅ Complete | 4 metrics, 10 definitions |
| Auto-certification trigger | ✅ Complete | Per snapshot fetch |
| Race condition mitigation | ✅ Complete | Unique index + try/except isolation |
| Portfolio milestone UI | ✅ Complete | Badge display, tier colors, collection modal |
| Dynamic metadata endpoint | 🔲 Planned | Epic 4 — 2-level auth, snapshot_hash in attributes |
| Manual cert NFT minting | 🔲 Planned | Purple badge, same mint flow |
| Anchor hash deprecation | 🔲 Planned | Superseded by NFT attributes |
| Portfolio verification page | 🔲 Planned | Public hash lookup, PLAND-auth full view |
| AI Storytelling | 🔲 Planned | Epic 5 — share mode + audit mode |
