// Database Configuration
// Supports both in-memory mock database and PostgreSQL

export interface DatabaseConfig {
  type: 'mock' | 'postgres';
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    poolSize?: number;
  };
}

export function getDatabaseConfig(): DatabaseConfig {
  const dbType = process.env.DATABASE_TYPE || 'mock';

  if (dbType === 'postgres') {
    return {
      type: 'postgres',
      postgres: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DATABASE || 'neural_trading',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || '',
        ssl: process.env.POSTGRES_SSL === 'true',
        poolSize: parseInt(process.env.POSTGRES_POOL_SIZE || '10', 10),
      },
    };
  }

  return { type: 'mock' };
}

export function getConnectionString(): string {
  const config = getDatabaseConfig();

  if (config.type !== 'postgres' || !config.postgres) {
    throw new Error('PostgreSQL configuration not available');
  }

  const { host, port, database, user, password, ssl } = config.postgres;
  const sslParam = ssl ? '?sslmode=require' : '';

  return `postgresql://${user}:${password}@${host}:${port}/${database}${sslParam}`;
}
