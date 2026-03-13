import { Database } from 'duckdb';
import sqlite3 from 'sqlite3';
import { logger } from '@/utils/logger';
import path from 'path';
import fs from 'fs/promises';

export interface ConnectionPoolStats {
  activeConnections: number;
  totalConnections: number;
  waitingRequests: number;
  totalQueries: number;
  averageQueryTime: number;
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private duckdb: Database | null = null;
  private sqlite: sqlite3.Database | null = null;
  private initialized = false;
  
  // Connection pool configuration
  private maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || '10');
  private activeConnections = 0;
  private queryQueue: Array<() => void> = [];
  
  // Performance monitoring
  private queryStats = {
    totalQueries: 0,
    totalExecutionTime: 0,
    slowQueries: [] as Array<{ sql: string; time: number; timestamp: Date }>
  };
  private slowQueryThreshold = 5000; // 5 seconds

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.initializeDuckDB();
      await this.initializeSQLite();
      this.initialized = true;
      logger.info('Database connections initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database connections:', error);
      throw error;
    }
  }

  private async initializeDuckDB(): Promise<void> {
    const duckdbPath = process.env.DUCKDB_PATH || './data/analytics.duckdb';
    
    // Ensure data directory exists
    const dataDir = path.dirname(duckdbPath);
    await fs.mkdir(dataDir, { recursive: true });

    this.duckdb = new Database(duckdbPath);
    
    // Test connection
    await new Promise<void>((resolve, reject) => {
      this.duckdb!.run('SELECT 1 as test', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    logger.info(`DuckDB initialized at ${duckdbPath}`);
  }
  private async initializeSQLite(): Promise<void> {
    const sqlitePath = process.env.SQLITE_PATH || './data/episodic_memory.db';
    
    // Ensure data directory exists
    const dataDir = path.dirname(sqlitePath);
    await fs.mkdir(dataDir, { recursive: true });

    this.sqlite = new sqlite3.Database(sqlitePath);
    
    // Create episodic memory tables
    await this.createEpisodicMemoryTables();
    
    logger.info(`SQLite initialized at ${sqlitePath}`);
  }

  private async createEpisodicMemoryTables(): Promise<void> {
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS episodic_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        query TEXT NOT NULL,
        response TEXT NOT NULL,
        confidence REAL NOT NULL,
        tools_used TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        data_state_checksum TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS session_flags (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        severity INTEGER NOT NULL,
        resolved BOOLEAN DEFAULT FALSE,
        source TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS state_changes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        affected_data TEXT NOT NULL,
        severity INTEGER NOT NULL,
        previous_value TEXT,
        current_value TEXT,
        timestamp DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_episodic_session ON episodic_entries(session_id);
      CREATE INDEX IF NOT EXISTS idx_episodic_timestamp ON episodic_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_flags_session ON session_flags(session_id);
      CREATE INDEX IF NOT EXISTS idx_state_changes_session ON state_changes(session_id);
    `;

    return new Promise<void>((resolve, reject) => {
      this.sqlite!.exec(createTablesSQL, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  public getDuckDB(): Database {
    if (!this.duckdb || !this.initialized) {
      throw new Error('DuckDB not initialized. Call initialize() first.');
    }
    return this.duckdb;
  }

  public getSQLite(): sqlite3.Database {
    if (!this.sqlite || !this.initialized) {
      throw new Error('SQLite not initialized. Call initialize() first.');
    }
    return this.sqlite;
  }

  /**
   * Execute DuckDB query with connection pooling and performance monitoring
   */
  public async executeDuckDBQuery(sql: string, params: any[] = []): Promise<any[]> {
    const startTime = Date.now();
    
    // Wait for available connection
    await this.acquireConnection();
    
    try {
      const result = await new Promise<any[]>((resolve, reject) => {
        this.getDuckDB().all(sql, params, (err, rows) => {
          if (err) {
            logger.error('DuckDB query error:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
      
      // Track performance
      const executionTime = Date.now() - startTime;
      this.trackQueryPerformance(sql, executionTime);
      
      return result;
    } finally {
      this.releaseConnection();
    }
  }

  /**
   * Execute SQLite query with connection pooling and performance monitoring
   */
  public async executeSQLiteQuery(sql: string, params: any[] = []): Promise<any[]> {
    const startTime = Date.now();
    
    // Wait for available connection
    await this.acquireConnection();
    
    try {
      const result = await new Promise<any[]>((resolve, reject) => {
        this.getSQLite().all(sql, params, (err, rows) => {
          if (err) {
            logger.error('SQLite query error:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
      
      // Track performance
      const executionTime = Date.now() - startTime;
      this.trackQueryPerformance(sql, executionTime);
      
      return result;
    } finally {
      this.releaseConnection();
    }
  }

  /**
   * Acquire connection from pool
   */
  private async acquireConnection(): Promise<void> {
    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++;
      return;
    }
    
    // Wait in queue
    return new Promise((resolve) => {
      this.queryQueue.push(resolve);
    });
  }

  /**
   * Release connection back to pool
   */
  private releaseConnection(): void {
    if (this.queryQueue.length > 0) {
      const next = this.queryQueue.shift();
      if (next) {
        next();
      }
    } else {
      this.activeConnections--;
    }
  }

  /**
   * Track query performance metrics
   */
  private trackQueryPerformance(sql: string, executionTime: number): void {
    this.queryStats.totalQueries++;
    this.queryStats.totalExecutionTime += executionTime;
    
    // Track slow queries
    if (executionTime > this.slowQueryThreshold) {
      this.queryStats.slowQueries.push({
        sql: sql.substring(0, 200), // Truncate for logging
        time: executionTime,
        timestamp: new Date()
      });
      
      // Keep only last 100 slow queries
      if (this.queryStats.slowQueries.length > 100) {
        this.queryStats.slowQueries.shift();
      }
      
      logger.warn('Slow query detected:', {
        sql: sql.substring(0, 200),
        executionTime,
        threshold: this.slowQueryThreshold
      });
    }
  }

  /**
   * Get connection pool statistics
   */
  public getPoolStats(): ConnectionPoolStats {
    return {
      activeConnections: this.activeConnections,
      totalConnections: this.maxConnections,
      waitingRequests: this.queryQueue.length,
      totalQueries: this.queryStats.totalQueries,
      averageQueryTime: this.queryStats.totalQueries > 0
        ? this.queryStats.totalExecutionTime / this.queryStats.totalQueries
        : 0
    };
  }

  /**
   * Get slow query log
   */
  public getSlowQueries(): Array<{ sql: string; time: number; timestamp: Date }> {
    return [...this.queryStats.slowQueries];
  }

  /**
   * Optimize query by adding hints and analyzing execution plan
   */
  public async optimizeQuery(sql: string): Promise<string> {
    // Basic query optimization hints
    let optimizedSql = sql;
    
    // Add LIMIT if not present for large result sets
    if (!sql.toLowerCase().includes('limit') && sql.toLowerCase().includes('select')) {
      logger.debug('Query optimization: Consider adding LIMIT clause');
    }
    
    // Suggest indexes for WHERE clauses
    if (sql.toLowerCase().includes('where')) {
      logger.debug('Query optimization: Ensure indexes exist on WHERE clause columns');
    }
    
    return optimizedSql;
  }

  public async close(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.duckdb) {
      promises.push(new Promise<void>((resolve) => {
        this.duckdb!.close(() => {
          logger.info('DuckDB connection closed');
          resolve();
        });
      }));
    }

    if (this.sqlite) {
      promises.push(new Promise<void>((resolve) => {
        this.sqlite!.close(() => {
          logger.info('SQLite connection closed');
          resolve();
        });
      }));
    }

    await Promise.all(promises);
    this.initialized = false;
  }
}