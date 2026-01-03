# TradeZZZ – TDD Phased Implementation Plan (to 90+)

This plan takes TradeZZZ from the current ~70/100 to **90+**, defined as:

- **Production‑ready live trading for real users**
- Supporting **Binance, Coinbase, Kraken**
- Supporting **paper + live**, including **spot + futures/margin**
- Integrated with **Anthropic, OpenAI, Grok** for signals, analysis, and risk commentary
- Giving users the choice between **human‑in‑the‑loop** and **autonomous** execution
- Prioritizing **latency, reliability, and security**

Each phase:
- Is **TDD‑first** (tests and contracts lead implementation).
- Ends with clear, testable deliverables.
- Improves: **latency**, **reliability**, and **security** on touched paths.

Target core coverage: **80–85%+** on trading, exchanges, risk, AI, and auth.

---

## Phase 1 – Baseline Hardening & CI/TDD Harness

**Goal:** Make the current system a stable, test‑driven base to extend.

**Scope**
- Fix failing tests (e.g., API route tests that bind ports) and standardize server creation for tests (unbound app vs. real listener).
- Add shared test helpers for:
  - Neon/Postgres (or test DB) setup/teardown.
  - Clerk/auth mocks.
  - AI provider and exchange adapters (pure mocks).
- Wire **Vitest + coverage thresholds** into CI.
- Add basic load‑test stubs and timing assertions for key endpoints.

**TDD Focus**
- Start by writing/repairing integration tests for:
  - `/api/health` (DB + auth if applicable).
  - Core routes (auth, strategies, orders, AI, exchanges) using **supertest** without binding to a real port.
- Add coverage thresholds (e.g., 80%) and enforce them via CI.

**Deliverables**
- All existing tests green in CI.
- Coverage report with thresholds enforced for core modules.
- `tests/helpers/*` updated with reusable mocks for DB, auth, AI, and exchanges.
- Short “How we test” doc describing:
  - Pure unit vs. integration tests.
  - Mocked vs. real integration tests.
  - How to run the suite locally and in CI.

---

## Phase 2 – Production Database & Auth (Neon + Clerk) Solidification

**Goal:** Rock‑solid multi‑user foundation on Vercel + managed Postgres.

**Scope**
- TDD around `NeonDatabase`, schema migrations, and `clerk.middleware` flows:
  - User creation/sync from Clerk.
  - Tier handling (free/pro/elite/institutional).
  - Deactivation/activation behavior.
- Add tests for **per‑user data isolation**, uniqueness constraints, and encryption invariants (PII, API keys).
- Introduce idempotent migrations and a `/api/health` check that verifies DB connectivity, schema version, and auth wiring.

**TDD Focus**
- Migration tests:
  - Migrations can be applied in order on a fresh DB.
  - Migrations can be re‑applied in CI/dev without corrupting state (idempotent).
- Auth tests:
  - Requests without tokens are rejected.
  - Requests with valid Clerk JWTs are mapped to users.
  - Inactive users cannot access protected endpoints.

**Deliverables**
- One‑command migration pipeline (e.g., `npm run db:migrate` or documented steps).
- `NeonDatabase` test coverage for all repositories (users, strategies, exchanges, AI providers, orders).
- Health check endpoint that verifies DB + auth and is used by CI and deployment.
- Vercel‑ready DB config/environment docs.

---

## Phase 3 – Core Exchange Connectivity (Spot, Paper + Live)

**Goal:** Real Binance/Coinbase/Kraken connectivity for spot trading, in both paper and live modes.

**Scope**
- Define an `ExchangeAdapter` interface and TDD it:
  - Methods for tickers, order books, balances, order creation/cancellation, and leverage/position queries (even if NOP for spot).
- Implement **real adapters** for:
  - Binance (spot, testnet by default in non‑prod).
  - Coinbase (spot/sandbox).
  - Kraken (spot).
- Extend `ExchangeService` to:
  - Persist exchange connections in Neon (encrypted keys).
  - Track rate‑limits and error categories.
  - Use adapters under the hood for real data.

**TDD Focus**
- Start with pure tests against **mock adapters**:
  - “User connects an exchange → stored in DB → can fetch balances and tickers via service.”
- Then, add small integration tests that can be toggled:
  - Real testnet/sandbox calls (flagged or nightly only).
  - Latency assertions on adapter methods (time‑bounded).

**Deliverables**
- API endpoints to:
  - Connect exchanges (store encrypted keys).
  - List connections per user.
  - Test a connection.
  - Fetch balances and basic tickers.
- E2E tests (mocked) for “connect exchange → list → test → read balances”.
- Nightly or manual testnet smoke suite for Binance/Coinbase/Kraken.

---

## Phase 4 – Futures & Margin Support + Risk Engine Upgrade

**Goal:** Futures/margin trading with robust safety rails.

**Scope**
- Extend `ExchangeAdapter` and related types for:
  - Futures/margin symbols and markets.
  - Leverage configuration.
  - Position modes (hedged vs. one‑way where relevant).
- Upgrade `OrderService` and risk components to enforce:
  - Max position size (symbol + portfolio level).
  - Leverage caps by tier.
  - Daily loss limits per user.
- Implement **kill switch & circuit breaker** behavior:
  - Automatic disablement of live trading when thresholds are breached.
  - Optional manual override with audit logging.

**TDD Focus**
- Unit tests for:
  - Margin/futures order validation and lifecycle.
  - Risk calculations (exposure, margin requirements, PnL).
- Scenario tests:
  - Sequence of losses triggering daily loss limit.
  - Over‑leverage attempts being rejected.
  - Kill switch activation preventing any new live orders.

**Deliverables**
- Futures/margin support in adapters and services.
- Risk policy configuration per tier (pulled from config service) with tests.
- Admin/owner observability:
  - Logs and metrics for risk events.
  - API endpoints to view risk status and toggles.

---

## Phase 5 – Strategy Engine & Trading Loop (GOAP + SAFLA Skeleton + AgentDB)

**Goal:** Real strategy execution engine powering orders, not just stubs.

**Scope**
- Define a **strategy DSL / JSON schema** (e.g., entry/exit rules, risk parameters, AI usage flags).
- TDD a **strategy runner** that:
  - Evaluates rules on market data and portfolio state.
  - Calls risk engine for approval.
  - Dispatches orders via `OrderService`.
- Introduce GOAP/SAFLA as **pluggable planners/learners**:
  - Initial version can be deterministic but must expose hooks for goals, actions, and feedback.
- Integrate **AgentDB** for pattern memory:
  - Store vectorized observations (state features + outcomes).
  - Retrieve nearest patterns to inform decisions.

**TDD Focus**
- Unit tests:
  - Strategy parsing and validation.
  - Rule evaluation on mock market & portfolio snapshots.
  - GOAP planning on small, deterministic goal/action graphs.
- Integration tests:
  - “Configure strategy → feed mock data → get signal → risk approves → paper order created.”

**Deliverables**
- A strategy configuration format documented and validated.
- Back‑to‑back tests showing the full loop:
  - Data → strategy → risk → order.
- AgentDB integration tested with mock vector search (no regression on latency).

---

## Phase 6 – Multi‑AI Providers (OpenAI, Anthropic, Grok) for Signals & Analysis

**Goal:** Anthropic + OpenAI + Grok integrated for signals, sentiment, and risk commentary.

**Scope**
- Finalize the `AIAdapter` abstraction and registry:
  - Adapters for OpenAI, Anthropic, Grok.
  - Provider selection per user and/or per strategy.
- Implement AI‑backed features:
  - Signal generation from aggregated market features.
  - Sentiment/news analysis.
  - Natural‑language risk explanations.
- Enhance UI/API:
  - Manage providers (add/rotate/delete keys).
  - Choose provider and model per strategy.

**TDD Focus**
- Tests with mocked HTTP responses:
  - Proper prompt construction for signals, sentiment, and risk commentary.
  - Error handling and retry/backoff behavior.
  - Fallbacks when primary provider fails (e.g., switch to backup).
- Integration tests:
  - Strategy that uses AI signals vs. one that doesn’t.
  - AI call timeouts respecting latency SLOs.

**Deliverables**
- `AIService` fully wired with OpenAI, Anthropic, Grok adapters.
- Management endpoints & UI controls for providers and models.
- Nightly smoke tests against real AI APIs (small, cost‑capped), with feature flags.

---

## Phase 7 – Backtesting, Midstreamer & Lean/Verification Loop

**Goal:** “Before you go live, you can trust it.”

**Scope**
- Implement a **backtest engine**:
  - Runs strategies on historical candles (local or fetched).
  - Produces metrics: equity curve, PnL, win rate, Sharpe, max drawdown, etc.
- Integrate **Midstreamer**:
  - Temporal pattern comparison (DTW, LCS) on price and signal series.
- Integrate **Lean‑Agentic** (or similar) for a constrained verification loop:
  - Check invariants: position bounds, leverage bounds, risk constraints.
- Enforce “paper first” flow:
  - Strategies must pass backtest requirements before live trading is enabled.

**TDD Focus**
- Backtest tests:
  - Exact PnL and drawdown computations from known sequences.
  - Deterministic replay of strategy decisions on recorded data.
- Verification tests:
  - Strategies that violate constraints are flagged and cannot go live.
  - Lean checks run and report with clear pass/fail signals.

**Deliverables**
- Backtest API and UI views:
  - Upload/select data, run backtest, view results.
- Hard gates in code (with tests):
  - No live trading without passing backtest thresholds (configurable).
- Docs: “How to design, test, and graduate a strategy to live.”

---

## Phase 8 – Swarm / Multi‑Agent Coordination

**Goal:** Multiple agents coordinating across exchanges and strategies, not just a single bot.

**Scope**
- Define `Agent` abstraction:
  - Examples: trader agent, risk agent, analysis agent, orchestrator.
- Implement **SwarmCoordinator**:
  - Capital allocation across strategies/agents.
  - Conflict resolution when multiple agents want overlapping trades.
  - Cross‑exchange opportunities (e.g., arbitrage suggestions).
- Wire swarm state into monitoring and UI.

**TDD Focus**
- Unit tests:
  - Agent lifecycle (init, act, receive feedback).
  - Coordination strategies: balanced, specialized, adaptive.
- Scenario tests:
  - Multiple agents proposing trades: ensure consistent portfolio and respect for risk limits.
  - Latency measurements as number of agents grows.

**Deliverables**
- Configurable swarm topologies (mesh, hierarchical, etc.) with tests.
- E2E tests:
  - Many agents/strategies → stable portfolio and no risk violations.
- UI/monitoring views for swarm health: per‑agent metrics, PnL contributions, decision counts.

---

## Phase 9 – Performance, Security, & Vercel Productionization

**Goal:** Latency, reliability, and security tuned for real money; Vercel‑first deployment.

**Scope**
- Performance:
  - Define latency SLOs on critical paths (order submission, risk checks, AI calls).
  - Add micro‑benchmarks and performance tests for trading loop and key endpoints.
- Security:
  - Threat modeling for API keys, JWTs, Clerk integration, WebSockets.
  - Tests for authN/authZ on all sensitive routes.
  - Double‑check encryption of secrets and correct use of env vars.
- Observability:
  - Structured logging (correlation IDs, user IDs where appropriate).
  - Metrics for p95 latencies, error rates, risk events, and AI usage.
  - Hooks for external alerting (e.g., webhooks or logging providers).
- Deployment:
  - Vercel + managed Postgres configuration (env schema, secrets).
  - Minimal runbooks for deploy, rollback, and incident response.

**TDD/Validation Focus**
- Performance tests:
  - Enforce SLOs via test thresholds where possible.
  - Load tests on core APIs using recorded scenarios.
- Security regression tests:
  - Negative tests for authZ: ensure no cross‑user data leaks.
  - Transport tests (e.g., HTTPS assumptions, CORS configuration) where applicable.

**Deliverables**
- Performance benchmark artifacts (docs + scripts).
- Security test suite and checklist.
- Vercel deployment config + “Production Readiness Checklist” that can be re‑run.
- Updated project rating target: 90+ with clearly documented criteria and evidence.

