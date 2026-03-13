import { jest } from '@jest/globals';

// Mock environment variables
process.env['NODE_ENV'] = 'test';
process.env['DUCKDB_PATH'] = ':memory:';
process.env['SQLITE_PATH'] = ':memory:';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['JWT_SECRET'] = 'test-secret';
process.env['LOG_LEVEL'] = 'error';

// Increase timeout for integration tests
jest.setTimeout(30000);