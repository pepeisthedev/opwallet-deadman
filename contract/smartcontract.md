 # Exportable Markdown Contract Plan: LegacyVaultStateMachine (OP_NET)

  ## Summary

  Create a standalone Markdown specification file for a future OP_NET smart contract implementation that supports the Deadman Wallet demo as a policy/state machine layer
  (not Bitcoin custody enforcement).

  This file should be written later as:

  - opwallet/docs/legacy-vault-opnet-contract-plan.md (recommended)
  - Fallback if docs/ does not exist: opwallet/legacy-vault-opnet-contract-plan.md

  The markdown should document:

  - Contract purpose and scope
  - State machine rules
  - Storage schema
  - Public methods and events
  - OP_WALLET integration expectations
  - Test scenarios
  - Security caveats and assumptions

  ## Goal and Success Criteria

  ### Goal

  Produce a decision-complete contract spec that an engineer can implement later in OP_NET without re-deciding contract behavior.

  ### Success Criteria

  - Covers the full MVP lifecycle: create -> checkIn -> trigger -> claim
  - Explicitly defines permissions and timing conditions
  - Includes event schema for OP_WALLET UI integration
  - Clarifies that first contract-enabled demo is policy-only + simulated/guided payout
  - Includes test cases and edge cases

  ## Scope (In / Out)

  ### In Scope

  - OP_NET contract state machine for deadman vault lifecycle
  - Multi-heir percentage storage (fixed shares in bps)
  - Timing policy (intervalSec, graceSec)
  - Owner check-ins
  - Overdue trigger
  - Claim/finalization status
  - Events for auditability and UI refresh
  - OP_WALLET integration mapping (controller methods and UI screens)

  ### Out of Scope

  - Bitcoin L1 Taproot custody enforcement
  - Oracle/guardian/dispute logic (future contract)
  - Watchtower incentive payouts
  - Legal will document encryption implementation (future registry contract)
  - Mainnet deployment strategy

  ## Important Public APIs / Interfaces / Types (to define in the markdown)

  The markdown file should include an explicit section named:

  ## Contract Interface (MVP)

  With these items:

  ### Contract Name

  - LegacyVaultStateMachine (working name)

  ### Public Methods (MVP)

  - createVault(heirs, sharesBps, intervalSec, graceSec, metadataHash?) -> vaultId
  - getVault(vaultId) -> Vault
  - checkIn(vaultId)
  - trigger(vaultId)
  - claim(vaultId) or finalizeClaim(vaultId, payoutRef) (pick one in spec; recommended below)

  ### Recommended method choice

  Use:

  - finalizeClaim(vaultId, payoutRef) (Recommended)
    Reason:
  - Supports policy-only demo while recording an external payout reference (payoutRef / txid / note hash)
  - Avoids implying the contract directly moves funds in MVP

  ### Events (MVP)

  - VaultCreated(vaultId, owner, createdAtTs)
  - CheckedIn(vaultId, owner, ts)
  - Triggered(vaultId, triggeredBy, ts)
  - ClaimFinalized(vaultId, finalizedBy, ts, payoutRef)

  ### State Enum

  - ACTIVE
  - TRIGGERED
  - CLAIMABLE (optional explicit state; recommended to derive)
  - CLAIMED
  - FROZEN (future reserved, not used in MVP)

  Recommended for MVP:

  - Store only ACTIVE | TRIGGERED | CLAIMED
  - Derive CLAIMABLE from TRIGGERED && !CLAIMED

  ### Data Types (document in markdown)

  - VaultId
  - HeirEntry { address, shareBps }
  - VaultRecord { ... }
  - VaultStatus
  - PayoutRef (string/bytes/hash depending OP_NET ABI constraints)

  ## Contract Behavior Spec (Decision Complete)

  The markdown should define these exact rules.

  ### createVault

  Inputs:

  - heirs[]
  - sharesBps[]
  - intervalSec
  - graceSec
  - optional metadataHash

  Validation:

  - heirs.length >= 1
  - heirs.length <= 10
  - heirs.length == sharesBps.length
  - each shareBps > 0
  - sum of sharesBps == 10000
  - no duplicate heir addresses
  - intervalSec > 0
  - graceSec >= 0

  State effects:

  - create vaultId
  - set owner = tx sender/origin
  - set createdAtTs = current block timestamp
  - set lastCheckInTs = createdAtTs
  - set status = ACTIVE

  Emit:

  - VaultCreated(...)

  ### checkIn(vaultId)

  Permissions:

  - owner only

  Preconditions:

  - vault exists
  - not claimed

  Effects:

  - lastCheckInTs = current block timestamp
  - if previously TRIGGERED, revert to ACTIVE (MVP-friendly veto behavior)

  Emit:

  - CheckedIn(...)

  ### trigger(vaultId)

  Permissions:

  - any caller (recommended for demo/watchtower compatibility)

  Preconditions:

  - vault exists
  - not claimed
  - now > lastCheckInTs + intervalSec + graceSec

  Effects:

  - set status = TRIGGERED
  - set triggeredAtTs = now if not already set

  Emit:

  - Triggered(...)

  ### finalizeClaim(vaultId, payoutRef) (recommended)

  Permissions:

  - any caller in MVP (or owner/heir only if address checks are easy)
  - Recommended MVP rule: any caller allowed, because this is policy-only finalization and demo-friendly

  Preconditions:

  - vault exists
  - not claimed
  - vault is overdue and triggered (or triggerable if combining steps is desired; recommended require triggered)

  Effects:

  - set status = CLAIMED
  - set claimedAtTs = now
  - store payoutRef

  Emit:

  - ClaimFinalized(...)

  ## Storage Schema (Markdown section)

  The markdown should include a section named:

  ## Storage Layout (MVP)

  Recommended fields for VaultRecord:

  - vaultId
  - owner
  - status
  - createdAtTs
  - lastCheckInTs
  - triggeredAtTs?
  - claimedAtTs?
  - intervalSec
  - graceSec
  - heirs[] (or map + count)
  - sharesBps[]
  - metadataHash?
  - payoutRef?

  Indexing recommendations:

  - owner -> vaultIds[] (if feasible)
  - If index arrays are expensive/awkward in OP_NET storage, document event-based indexing fallback for OP_WALLET

  ## OP_WALLET Integration Section (Markdown content requirements)

  The markdown must include a section named:

  ## OP_WALLET Integration (MVP)

  Document mapping to existing wallet code paths already added:

  - UI screens:
      - LegacyVaultHomeScreen
      - LegacyVaultCreateScreen
      - LegacyVaultReviewScreen
      - LegacyVaultStatusScreen
      - LegacyVaultClaimScreen
  - Controller methods:
      - legacyVault_finalizeAndCreate
      - legacyVault_checkIn
      - legacyVault_trigger
      - legacyVault_claim
      - legacyVault_getVault
      - legacyVault_listVaults

  And specify future replacement:

  - Replace local demo LegacyVaultService transitions with OP_NET contract calls + receipt parsing
  - Keep method signatures stable so UI doesn’t change

  Include event-to-UI mapping:

  - VaultCreated -> add vault to list
  - CheckedIn -> update deadline/status
  - Triggered -> show claimable path
  - ClaimFinalized -> mark claimed and show reference

  ## Security / Trust Model Section (Markdown content requirements)

  The markdown must include a section named:

  ## Security Model & Limitations (MVP)

  Required statements:

  - This contract is a policy/orchestration layer, not Bitcoin L1 consensus custody enforcement
  - OP_NET/P2OP trust model caveat must be stated explicitly
  - No automatic BTC transfer guarantee in MVP
  - finalizeClaim records claim finalization/payout reference; it does not prove Bitcoin script enforcement

  ## Test Cases and Scenarios (must be included in markdown)

  Include a section named:

  ## Test Plan (Contract MVP)

  ### Happy Path

  1. Create vault with 2 heirs (60/40)
  2. Check in before deadline
  3. Advance time past interval + grace
  4. Trigger
  5. Finalize claim with payoutRef
  6. Verify CLAIMED and emitted events

  ### Validation Failures

  1. Shares not equal to 10000 bps -> revert
  2. Duplicate heirs -> revert
  3. Zero interval -> revert
  4. checkIn on missing vault -> revert
  5. trigger before overdue -> revert
  6. finalizeClaim before trigger -> revert

  ### Permission / State Edge Cases

  1. Non-owner check-in -> revert
  2. Trigger twice -> idempotent or revert (spec must choose one; recommended idempotent/no-op with event omitted)
  3. Check-in after triggered -> resets to active (MVP chosen behavior)
  4. Finalize claim twice -> revert

  ### Event Integrity

  - Validate emitted field values match stored values after each transition

  ## Markdown File Structure (exact sections to include)

  The exported .md should use this order:

  1. # LegacyVaultStateMachine (OP_NET) Contract Plan
  2. ## Overview
  3. ## Scope (MVP)
  4. ## Non-Goals
  5. ## Security Model & Limitations (MVP)
  6. ## State Machine
  7. ## Storage Layout (MVP)
  8. ## Contract Interface (MVP)
  9. ## Method Semantics
  10. ## Events
  11. ## OP_WALLET Integration (MVP)
  12. ## Deployment Plan (OP_NET Testnet)
  13. ## Test Plan (Contract MVP)
  14. ## Future Extensions
  15. ## Assumptions

  ## Deployment Plan Section (Markdown content requirements)

  Include a short actionable deployment checklist for later:

  - Confirm OP_NET SDK/runtime version compatibility in opwallet
  - Implement contract in dedicated folder (e.g., contracts/legacy-vault/)
  - Compile/deploy to OP_NET testnet
  - Record contract address and ABI
  - Add address/ABI config to OP_WALLET background service


  The markdown should include a ## Future Extensions section with:

  - Guardian/Oracle Attestation contract
  - Will Metadata Registry contract
  - Recovery Delay Controller
  - Watchtower Bounty contract
  - Bitcoin-native Taproot custody integration (hybrid mode)

  ## Explicit Assumptions and Defaults

  Document these assumptions in the markdown:

  - First contract-enabled demo is policy-only + simulated/guided payout
  - OP_NET testnet is the deployment target
  - OP_WALLET UI/controller APIs remain as currently added
  - Local LegacyVaultService is a temporary fallback/mock until contract integration lands
  - finalizeClaim(vaultId, payoutRef) is preferred over a payout-moving claim() for MVP clarity
