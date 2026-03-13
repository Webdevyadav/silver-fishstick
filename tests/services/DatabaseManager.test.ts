import { DatabaseManager } from '@/services/DatabaseManager';
import { logger } from '@/utils/logger';

// Mock logger to avoid console output during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = DatabaseManager.getInstance();
  });

  afterEach(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  describe('initialization', () => {
    it('should initialize database connections successfully', async () => {
      await expect(dbManager.initialize()).resolves.not.toThrow();
      expect(logger.info).toHaveBeenCalledWith('Database connections initialized successfully');
    });

    it('should not reinitialize if already initialized', async () => {
      await dbManager.initialize();
      const loggerInfoSpy = jest.mocked(logger.info);
      loggerInfoSpy.mockClear();
      
      await dbManager.initialize();
      expect(loggerInfoSpy).not.toHaveBeenCalledWith('Database connections initialized successfully');
    });
  });

  describe('query execution', () => {
    beforeEach(async () => {
      await dbManager.initialize();
    });

    it('should execute DuckDB queries successfully', async () => {
      const result = await dbManager.executeDuckDBQuery('SELECT 1 as test');
      expect(result).toEqual([{ test: 1 }]);
    });

    it('should execute SQLite queries successfully', async () => {
      const result = await dbManager.executeSQLiteQuery('SELECT 1 as test');
      expect(result).toEqual([{ test: 1 }]);
    });

    it('should handle query errors gracefully', async () => {
      await expect(
        dbManager.executeDuckDBQuery('INVALID SQL')
      ).rejects.toThrow();
    });
  });
});