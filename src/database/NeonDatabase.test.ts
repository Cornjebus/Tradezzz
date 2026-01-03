import { describe, it, expect, beforeEach } from 'vitest';
import { NeonDatabase } from './NeonDatabase';

describe('NeonDatabase', () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    // Use a fake connection string; Pool will not connect until .connect() is called
    process.env.DATABASE_URL = 'postgres://test_user:test_pass@localhost:5432/test_db';
  });

  it('should_construct_with_valid_connection_string_without_connecting', () => {
    const db = new NeonDatabase();

    // Basic smoke check that repositories are defined
    expect(db.users).toBeDefined();
    expect(db.strategies).toBeDefined();
    expect(db.orders).toBeDefined();
    expect(db.backtests).toBeDefined();
    expect(db.orderApprovals).toBeDefined();
  });

  // Note: we intentionally do not test initializeDatabase() here because it
  // requires a live Postgres/Neon instance, which is handled by higher-level
  // integration tests that use tests/helpers/test-db.ts.

  afterAll(() => {
    process.env.DATABASE_URL = originalEnv;
  });
});
