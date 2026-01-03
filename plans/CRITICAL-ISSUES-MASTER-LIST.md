# Tradezzz Platform - Critical Issues Master List

## Executive Summary

A comprehensive audit of the Tradezzz trading platform has identified **100+ issues** across 7 major categories. This document catalogs all issues by severity and provides remediation guidance.

**Test Results:** 855 passing | 2 failed | 36 skipped

---

## Issue Severity Legend

| Level | Description |
|-------|-------------|
| **CRITICAL** | Security vulnerabilities, data loss, system unusable |
| **HIGH** | Major functionality broken, significant bugs |
| **MEDIUM** | Feature incomplete, inconsistent behavior |
| **LOW** | Minor issues, code quality, UX problems |

---

## Category 1: Authentication & Authorization (14 Issues)

### CRITICAL Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 1.1 | **Dev auth bypass allows unauthenticated access** - Any request without Authorization header auto-authenticates as a real user | `src/api/middleware/clerk.middleware.ts` | 36-78 |
| 1.2 | **Missing auth token forwarding in proxy routes** - Backend receives no authentication from Next.js proxies | `app/app/api/patterns/risk/graph/route.ts` | 16-17 |
| 1.3 | **Express server has NO Clerk integration** - Uses separate JWT/AuthService system | `src/api/server.ts` | 1-275 |
| 1.4 | **Exchanges endpoint public but route checks auth** - Middleware/route mismatch | `app/middleware.ts` | 12 |

### HIGH Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 1.5 | No Authorization headers in frontend API calls | `app/app/dashboard/page.tsx` | 186-192 |
| 1.6 | User sync happens on EVERY request (performance) | `app/lib/auth.ts` | 19-39 |
| 1.7 | Encryption key hardcoded in .env files | `.env`, `app/.env.local` | 13, 9 |
| 1.8 | Missing ownership verification in PUT endpoints | `app/app/api/ai-providers/route.ts` | 155-172 |
| 1.9 | CORS middleware missing origin validation | `app/middleware.ts` | 18-25 |
| 1.10 | Tier system only enforced in Express, not Next.js | `src/api/middleware/clerk.middleware.ts` | 195-212 |

### MEDIUM Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 1.11 | No CSRF protection on POST/PUT/DELETE | Multiple | - |
| 1.12 | Session timeout not configured | `app/middleware.ts` | - |
| 1.13 | No audit logging of auth events | Multiple | - |
| 1.14 | Environment variables not validated at startup | `app/lib/encryption.ts` | 10-14 |

---

## Category 2: Database Layer (14 Issues)

### CRITICAL Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 2.1 | **Type definition mismatch** - snake_case vs camelCase between DB and TypeScript | `app/lib/db.ts`, `src/database/types.ts` | Multiple |
| 2.2 | **Missing DELETE method for orders repository** | `app/lib/db.ts` | 449-527 |

### HIGH Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 2.3 | Missing updated_at triggers for backtests/trades tables | `src/database/migrations/001_initial_schema.sql` | 318 |
| 2.4 | DATABASE_URL not in .env.example | `.env.example` | - |
| 2.5 | Missing trigger for order_approvals.updated_at | `src/database/migrations/004_add_order_approvals.sql` | 6-30 |
| 2.6 | Password not URL encoded in connection string | `src/config/database.config.ts` | 48 |

### MEDIUM Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 2.7 | No transactions for related inserts | `src/api/routes/order.routes.ts` | Multiple |
| 2.8 | Missing index on order_id in order_approvals | `src/database/migrations/004_add_order_approvals.sql` | 19 |
| 2.9 | Excessive connection pooling in serverless | `app/lib/db.ts` | 116 |
| 2.10 | Hardcoded 'clerk-managed' password hash | `src/database/NeonDatabase.ts` | 146, 200 |
| 2.11 | SSL certificate validation disabled | `src/database/NeonDatabase.ts`, `app/lib/db.ts` | 30, 117 |

### LOW Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 2.12 | Timezone VARCHAR(100) oversized | `src/database/migrations/001_initial_schema.sql` | 56 |
| 2.13 | Missing primary key pattern consistency | `src/database/migrations/001_initial_schema.sql` | 269 |
| 2.14 | Test database role "postgres" does not exist | `tests/helpers/test-db.ts` | 28 |

---

## Category 3: API Routes (15 Issues)

### CRITICAL Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 3.1 | **Response format inconsistency** - Express uses `{success, data}`, Next.js returns raw objects | Multiple Next.js routes | - |
| 3.2 | **Missing routes that frontend expects** - No individual resource endpoints in Next.js | Multiple | - |

### HIGH Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 3.3 | CORS headers incomplete (missing origin) | `app/middleware.ts` | 23-31 |
| 3.4 | Auth forwarding missing in proxy | `app/app/api/ai/auto/chat/route.ts` | 14-24 |
| 3.5 | HTTP method mismatch (PUT vs POST for actions) | `app/app/api/orders/route.ts` | 121+ |
| 3.6 | Validation inconsistency Express vs Next.js | Multiple | - |
| 3.7 | Proxy routes depend on backend running | 10+ routes | - |

### MEDIUM Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 3.8 | Database column case mismatch (user_id vs userId) | `app/app/api/strategies/route.ts` | 98+ |
| 3.9 | No timeout handling for proxy requests | Multiple | - |
| 3.10 | Property name mismatch in responses | `app/app/api/ai-providers/route.ts` | 35-45 |
| 3.11 | Missing error context in catch blocks | Multiple | - |
| 3.12 | Request validation incomplete | `app/app/api/orders/route.ts` | 59-80 |

### LOW Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 3.13 | No circuit breaker for backend failures | Multiple | - |
| 3.14 | Middleware ordering concerns | `src/api/server.ts` | 140 |
| 3.15 | Stale comments referencing unimplemented features | Multiple | - |

---

## Category 4: Frontend Components (20 Issues)

### CRITICAL Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 4.1 | **Save buttons not implemented in Settings** - Profile and preferences don't save | `app/app/dashboard/settings/page.tsx` | 93, 246 |
| 4.2 | **Exchange connection property mismatch** - `is_active` vs `status` | `app/app/dashboard/exchanges/page.tsx` | 45, 338 |
| 4.3 | **Trading mode state not persisted** - Mode dropdown changes ignored | `app/app/dashboard/layout.tsx` | 178-211 |
| 4.4 | **Missing passphrase field for Coinbase** | `app/app/dashboard/exchanges/page.tsx` | 256-274 |

### HIGH Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 4.5 | Delete account not implemented | `app/app/dashboard/settings/page.tsx` | 300-322 |
| 4.6 | Strategy Settings/Copy buttons non-functional | `app/app/dashboard/strategies/page.tsx` | 618-620 |
| 4.7 | Recommendations format mismatch | `app/app/dashboard/strategies/page.tsx` | 115-120 |
| 4.8 | Price loading has no error feedback | `app/app/dashboard/page.tsx` | 174-175 |
| 4.9 | Order stats race condition | `app/app/dashboard/orders/page.tsx` | 70-77 |

### MEDIUM Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 4.10 | API response property naming mismatches | Multiple | - |
| 4.11 | Missing null checks and type safety | Multiple | - |
| 4.12 | Form validation missing | `app/dashboard/ai-providers/page.tsx` | 114-129 |
| 4.13 | Portfolio fetch failure shows "$0.00" silently | `app/app/dashboard/page.tsx` | 391-393 |
| 4.14 | Race conditions in data fetching | `app/app/dashboard/page.tsx` | 449-462 |

### LOW Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 4.15 | Fallback name "Sleeper" misleading | `app/app/dashboard/layout.tsx` | 101, 153 |
| 4.16 | Unused NEXT_PUBLIC_API_URL env var | Multiple | - |
| 4.17 | No auth error boundary | Multiple | - |
| 4.18 | Assistant response parsing fragile | `app/app/dashboard/page.tsx` | 560-572 |
| 4.19 | Type safety issues with nullable metrics | `app/app/dashboard/strategies/page.tsx` | 74 |
| 4.20 | camelCase vs snake_case inconsistency | Multiple | - |

---

## Category 5: AI Provider Integration (15 Issues)

### CRITICAL Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 5.1 | **Missing Cohere and Mistral adapters** - Listed in API but not implemented | `src/ai/adapters/index.ts` | 13-19 |
| 5.2 | **Three different encryption implementations** - No coordination | Multiple | - |

### HIGH Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 5.3 | Inconsistent provider definitions across 4 files | Multiple | - |
| 5.4 | Response parsing uses greedy regex | All adapters | - |
| 5.5 | No rate limiting implementation | All adapters | - |
| 5.6 | Silent error swallowing in API routes | `app/app/api/ai-providers/route.ts` | 131, 151 |
| 5.7 | testProvider() always returns valid:true | `src/ai/AIProviderService.ts` | 416-427 |

### MEDIUM Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 5.8 | Hardcoded token estimates instead of actual | `src/ai/AIProviderService.ts` | 514-515 |
| 5.9 | Sentiment analysis uses keyword-only fallback | `src/ai/AIProviderService.ts` | 554-611 |
| 5.10 | Division by zero risk in sentiment | `src/ai/AIProviderService.ts` | 573 |
| 5.11 | Non-null assertions on optional fields | `src/ai/AIProviderService.ts` | 355 |
| 5.12 | Database access patterns inconsistent | Multiple | - |

### LOW Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 5.13 | Timeout values not standardized | All adapters | - |
| 5.14 | Grok base URL from env without validation | `src/ai/adapters/GrokAdapter.ts` | 48 |
| 5.15 | Two different encryption key derivation strategies | Multiple | - |

---

## Category 6: Trading & Order Execution (14 Issues)

### CRITICAL Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 6.1 | **entryPrice not updateable in positions** - Position averaging broken | `src/database/NeonDatabase.ts` | 685-714 |
| 6.2 | **Approval status never updated** - Can approve same order multiple times | `src/api/server.new.ts` | 2131-2169 |

### HIGH Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 6.3 | No re-validation of risk limits on approval | `src/api/server.new.ts` | 2118-2214 |
| 6.4 | Non-transactional order + trade creation | `src/api/server.new.ts` | 2131-2168 |
| 6.5 | entry_price not in position update fields | `src/database/NeonDatabase.ts` | 685-714 |
| 6.6 | Graph risk gating skipped for approvals | `src/api/server.new.ts` | 2118-2214 |

### MEDIUM Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 6.7 | filledAt tracking issues | `src/execution/NeonLiveTradingService.ts` | 50-57 |
| 6.8 | Partial close entry price not preserved | `src/execution/NeonLiveTradingService.ts` | 153-160 |
| 6.9 | No price bounds validation for fills | `src/api/server.new.ts` | 1488-1502 |
| 6.10 | Two separate paper trading implementations | `OrderService.ts`, `trading.routes.ts` | - |

### LOW Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 6.11 | Backtest metrics null not handled | `src/backtesting/BacktestService.ts` | 425-432 |
| 6.12 | Property name case inconsistency | `src/api/server.new.ts` | 1887 |
| 6.13 | Exchange order ID update support unclear | `src/database/NeonDatabase.ts` | 528-551 |
| 6.14 | Field mapping inconsistencies | Multiple | - |

---

## Category 7: Configuration & Environment (12 Issues)

### CRITICAL Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 7.1 | **Hardcoded default encryption keys** | `src/config/ConfigService.ts` | 393, 396 |
| 7.2 | **Test credentials exposed in version control** | `.env`, `app/.env.local` | Multiple |
| 7.3 | **Dev auth bypass in production code path** | `src/api/middleware/clerk.middleware.ts` | 37-84 |

### HIGH Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 7.4 | Hardcoded localhost:3001 in 10 routes | Multiple Next.js routes | - |
| 7.5 | CORS only allows localhost origins | `src/api/server.ts` | 137 |
| 7.6 | Default database password is 'postgres' | `src/database/PostgresDatabase.ts` | 581 |
| 7.7 | SSL validation disabled (rejectUnauthorized: false) | Multiple | - |

### MEDIUM Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 7.8 | No encryption key length validation | `app/lib/encryption.ts` | 14-17 |
| 7.9 | CLERK_SECRET_KEY not validated | `src/api/middleware/clerk.middleware.ts` | 11-13 |
| 7.10 | Empty Next.js config | `app/next.config.ts` | - |
| 7.11 | Missing env vars in .env.example | `.env.example` | - |

### LOW Issues

| # | Issue | File | Lines |
|---|-------|------|-------|
| 7.12 | Playwright hardcoded baseURL | `app/playwright.config.ts` | 10 |

---

## Test Failures

### Failed Test Suites

| Suite | Error | File | Line |
|-------|-------|------|------|
| Database.test.ts | `role "postgres" does not exist` | `tests/helpers/test-db.ts` | 28 |
| SwarmCoordinator.test.ts | Syntax error - `Expected ")" but found end of file` | `src/swarm/SwarmCoordinator.test.ts` | 101 |

---

## Priority Remediation Order

### Immediate (Security Critical)

1. Remove dev auth bypass from clerk.middleware.ts
2. Rotate all exposed credentials (DATABASE_URL, ENCRYPTION_KEY, CLERK_SECRET_KEY)
3. Add auth token forwarding to all proxy routes
4. Fix encryption key hardcoding

### Short Term (Functionality)

5. Add passphrase field for Coinbase/KuCoin/OKX
6. Fix type definition mismatches (snake_case vs camelCase)
7. Implement real testConnection() for exchanges
8. Fix Settings page save buttons
9. Implement missing adapter factory wiring
10. Add missing Cohere/Mistral adapters

### Medium Term (Stability)

11. Unify response formats (Express vs Next.js)
12. Add missing Next.js routes for individual resources
13. Fix CORS configuration for production
14. Add transactions for related database operations
15. Implement rate limiting

### Long Term (Quality)

16. Consolidate paper trading implementations
17. Add comprehensive error handling
18. Implement audit logging
19. Add circuit breakers for backend proxies
20. Standardize timeout values

---

## Summary Statistics

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Auth & Authorization | 4 | 6 | 4 | 0 | 14 |
| Database | 2 | 4 | 5 | 3 | 14 |
| API Routes | 2 | 5 | 5 | 3 | 15 |
| Frontend | 4 | 5 | 5 | 6 | 20 |
| AI Providers | 2 | 5 | 5 | 3 | 15 |
| Trading/Orders | 2 | 4 | 4 | 4 | 14 |
| Config/Env | 3 | 4 | 4 | 1 | 12 |
| **Total** | **19** | **33** | **32** | **20** | **104** |

---

## Next Steps

1. Review this document with the team
2. Create GitHub issues for each category
3. Prioritize based on remediation order above
4. Begin with security-critical fixes immediately
5. Create TDD test cases before each fix
6. Establish code review process for security changes
