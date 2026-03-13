import { Database } from 'duckdb';
import sqlite3 from 'sqlite3';
import { logger } from '@/utils/logger';
import path from 'path';
import fs from 'fs/promises';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private duckdb: Database | null = null;
  private sqlite: sqlite3.Database | null = null;
  private initialized = false;

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

  public async executeDuckDBQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.getDuckDB().all(sql, params, (err, rows) => {
        if (err) {
          logger.error('DuckDB query error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  public async executeSQLiteQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.getSQLite().all(sql, params, (err, rows) => {
        if (err) {
          logger.error('SQLite query error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
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