# TradeZZZ Testing Guide

This document summarizes how tests are structured and how to run them.

## Test Stack

- **Runner**: [Vitest](https://vitest.dev/) (Node environment)
- **Coverage**: V8-based coverage with thresholds enforced
- **HTTP testing**: `supertest` for API route tests against Express apps
- **DB testing**:
  - In-memory `MockDatabase` for most unit and integration tests
  - Optional Postgres/Neon tests via helpers in `tests/helpers/test-db.ts`

## Test Layout

- `src/**/*.test.ts`
  - Unit and integration tests close to the implementation
  - Examples: security, AI services, rate limiting, risk, backtesting, trading engines
- `tests/helpers`
  - `mock-db.ts`: in-memory database for fast, deterministic tests
  - `test-db.ts`: helpers for running tests against a real Postgres/Neon instance

## API Route Tests

API route tests create an **Express app in-memory** and mount only the routes under test:

- No real ports are bound in the application code.
- `supertest` wraps the Express app and issues HTTP calls against it.
- Error handling middleware is attached so responses match production behavior.

This pattern keeps tests fast and avoids coupling to the full server startup.

## Coverage Thresholds

Vitest is configured with **minimum coverage thresholds** (lines, functions, branches, statements). The goal is to keep and raise coverage for:

- Core trading and execution logic
- Exchange integration and rate limiting
- AI services and adapters
- Auth, security, and encryption

You can see detailed coverage reports in the `coverage/` output (`text`, `json`, and `html` reports).

## Running Tests

Basic commands:

- `npm test` – run the full test suite once
- `npm run test:watch` – run tests in watch mode
- `npm run test:coverage` – run tests and generate coverage reports

Some environments (like restricted sandboxes) may block binding ephemeral ports, which `supertest` uses internally. In those environments, API route tests can fail with `listen EPERM`. On a normal dev or CI environment, they should pass.

