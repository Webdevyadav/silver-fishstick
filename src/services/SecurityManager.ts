import crypto from 'crypto';
import { logger } from '@/utils/logger';
import fs from 'fs/promises';
import path from 'path';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  keyRotationIntervalMs: number;
  masterKeyPath: string;
}

export interface EncryptedData {
  data: string;
  iv: string;
  tag: string;
  keyId: string;
  algorithm: string;
  timestamp: Date;
}

export interface KeyMetadata {
  keyId: string;
  createdAt: Date;
  rotatedAt?: Date;
  status: 'active' | 'deprecated' | 'revoked';
  algorithm: string;
  purpose: 'data_encryption' | 'session_encryption' | 'backup_encryption';
}

/**
 * SecurityManager - Handles comprehensive data encryption and protection
 * 
 * Implements AES-256-GCM encryption for all persistent data storage,
 * secure key management with rotation, and data anonymization for logging.
 */
export class SecurityManager {
  private static instance: SecurityManager;
  private config: EncryptionConfig;
  private activeKeys: Map<string, Buffer> = new Map();
  private keyMetadata: Map<string, KeyMetadata> = new Map();
  private masterKey: Buffer | null = null;
  private initialized = false;
  private keyRotationTimer?: NodeJS.Timeout;

  private constructor(config?: Partial<EncryptionConfig>) {
    this.config = {
      algorithm: 'aes-256-gcm', // Upgraded to GCM for authenticated encryption
      keyLength: 32, // 256 bits
      ivLength: 12,  // 96 bits for GCM
      tagLength: 16, // 128 bits authentication tag
      keyRotationIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
      masterKeyPath: process.env['MASTER_KEY_PATH'] || './keys/master.key',
      ...config
    };
  }

  public static getInstance(config?: Partial<EncryptionConfig>): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager(config);
    }
    return SecurityManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ensure keys directory exists
      const keysDir = path.dirname(this.config.masterKeyPath);
      await fs.mkdir(keysDir, { recursive: true });

      // Load or generate master key
      await this.loadOrGenerateMasterKey();

      // Load existing encryption keys
      await this.loadEncryptionKeys();

      // Start key rotation timer
      this.startKeyRotation();

      this.initialized = true;
      logger.info('SecurityManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SecurityManager:', error);
      throw error;
    }
  }

  /**
   * Encrypt data using AES-256-GCM with authenticated encryption
   */
  public async encryptData(
    data: string | Buffer, 
    purpose: KeyMetadata['purpose'] = 'data_encryption'
  ): Promise<EncryptedData> {
    this.ensureInitialized();

    const activeKey = await this.getActiveKey(purpose);
    const keyId = this.getActiveKeyId(purpose);
    
    const plaintext = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const iv = crypto.randomBytes(this.config.ivLength);
    
    // Use AES-256-GCM for authenticated encryption
    const cipher = crypto.createCipher('aes-256-gcm', activeKey);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
      data: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      keyId,
      algorithm: 'aes-256-gcm',
      timestamp: new Date()
    };
  }

  /**
   * Decrypt data using the appropriate key with authenticated decryption
   */
  public async decryptData(encryptedData: EncryptedData): Promise<Buffer> {
    this.ensureInitialized();

    const key = this.activeKeys.get(encryptedData.keyId);
    if (!key) {
      throw new Error(`Encryption key ${encryptedData.keyId} not found`);
    }

    const data = Buffer.from(encryptedData.data, 'base64');
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');
    
    if (encryptedData.algorithm === 'aes-256-gcm') {
      // Use GCM for authenticated decryption
      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(data),
        decipher.final()
      ]);
      
      return decrypted;
    } else {
      // Fallback to CBC with HMAC verification for backward compatibility
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(data);
      hmac.update(iv);
      hmac.update(encryptedData.keyId);
      const expectedTag = hmac.digest();
      
      if (!crypto.timingSafeEqual(tag, expectedTag)) {
        throw new Error('Data integrity check failed');
      }
      
      const decipher = crypto.createDecipher('aes-256-cbc', key);
      
      const decrypted = Buffer.concat([
        decipher.update(data),
        decipher.final()
      ]);
      
      return decrypted;
    }
  }

  /**
   * Encrypt file contents
   */
  public async encryptFile(
    filePath: string, 
    outputPath: string,
    purpose: KeyMetadata['purpose'] = 'data_encryption'
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const fileData = await fs.readFile(filePath);
      const encryptedData = await this.encryptData(fileData, purpose);
      
      // Store encrypted data with metadata
      const encryptedFile = {
        ...encryptedData,
        originalPath: filePath,
        encryptedAt: new Date()
      };
      
      await fs.writeFile(outputPath, JSON.stringify(encryptedFile, null, 2));
      logger.debug(`Encrypted file ${filePath} to ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to encrypt file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Decrypt file contents
   */
  public async decryptFile(encryptedFilePath: string, outputPath: string): Promise<void> {
    this.ensureInitialized();

    try {
      const encryptedFileContent = await fs.readFile(encryptedFilePath, 'utf8');
      const encryptedData = JSON.parse(encryptedFileContent) as EncryptedData;
      
      const decryptedData = await this.decryptData(encryptedData);
      await fs.writeFile(outputPath, decryptedData);
      
      logger.debug(`Decrypted file ${encryptedFilePath} to ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to decrypt file ${encryptedFilePath}:`, error);
      throw error;
    }
  }

  /**
   * Generate secure hash for data integrity
   */
  public generateHash(data: string | Buffer, algorithm: string = 'sha256'): string {
    const input = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    return crypto.createHash(algorithm).update(input).digest('hex');
  }

  /**
   * Anonymize PII data for logging
   */
  public anonymizePII(data: any): any {
    if (typeof data === 'string') {
      return this.anonymizeString(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.anonymizePII(item));
    }
    
    if (data && typeof data === 'object') {
      const anonymized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isPIIField(key)) {
          anonymized[key] = this.anonymizeValue(value);
        } else {
          anonymized[key] = this.anonymizePII(value);
        }
      }
      return anonymized;
    }
    
    return data;
  }

  /**
   * Rotate encryption keys with enhanced security
   */
  public async rotateKeys(): Promise<void> {
    this.ensureInitialized();

    try {
      const purposes: KeyMetadata['purpose'][] = ['data_encryption', 'session_encryption', 'backup_encryption'];
      const rotationResults: { purpose: string; oldKeyId: string; newKeyId: string }[] = [];
      
      for (const purpose of purposes) {
        const oldKeyId = this.getActiveKeyId(purpose);
        
        // Mark old key as deprecated first
        const oldMetadata = this.keyMetadata.get(oldKeyId);
        if (oldMetadata) {
          oldMetadata.status = 'deprecated';
          oldMetadata.rotatedAt = new Date();
        }
        
        // Generate new key (which becomes active)
        const newKeyId = await this.generateNewKey(purpose);
        
        rotationResults.push({ purpose, oldKeyId, newKeyId });
        logger.info(`Rotated ${purpose} key from ${oldKeyId} to ${newKeyId}`);
      }
      
      // Save updated key metadata with backup
      await this.backupKeyMetadata();
      await this.saveKeyMetadata();
      
      // Verify rotation was successful
      await this.verifyKeyRotation(rotationResults);
      
      logger.info('Key rotation completed successfully', {
        rotatedKeys: rotationResults.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Failed to rotate encryption keys:', error);
      // Attempt to restore from backup if rotation failed
      await this.restoreKeyMetadataFromBackup();
      throw error;
    }
  }

  /**
   * Get encryption statistics
   */
  public getEncryptionStats(): {
    activeKeys: number;
    deprecatedKeys: number;
    revokedKeys: number;
    lastRotation: Date | null;
    nextRotation: Date;
  } {
    const stats = {
      activeKeys: 0,
      deprecatedKeys: 0,
      revokedKeys: 0,
      lastRotation: null as Date | null,
      nextRotation: new Date(Date.now() + this.config.keyRotationIntervalMs)
    };

    for (const metadata of this.keyMetadata.values()) {
      switch (metadata.status) {
        case 'active':
          stats.activeKeys++;
          break;
        case 'deprecated':
          stats.deprecatedKeys++;
          if (!stats.lastRotation || (metadata.rotatedAt && metadata.rotatedAt > stats.lastRotation)) {
            stats.lastRotation = metadata.rotatedAt || null;
          }
          break;
        case 'revoked':
          stats.revokedKeys++;
          break;
      }
    }

    return stats;
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SecurityManager not initialized. Call initialize() first.');
    }
  }

  private async loadOrGenerateMasterKey(): Promise<void> {
    try {
      // Try to load existing master key
      const masterKeyData = await fs.readFile(this.config.masterKeyPath);
      this.masterKey = masterKeyData;
      logger.debug('Loaded existing master key');
    } catch (error) {
      // Generate new master key if it doesn't exist
      this.masterKey = crypto.randomBytes(32);
      await fs.writeFile(this.config.masterKeyPath, this.masterKey, { mode: 0o600 });
      logger.info('Generated new master key');
    }
  }

  private async loadEncryptionKeys(): Promise<void> {
    const keysMetadataPath = path.join(path.dirname(this.config.masterKeyPath), 'keys-metadata.json');
    
    try {
      const metadataContent = await fs.readFile(keysMetadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      for (const [keyId, keyMeta] of Object.entries(metadata)) {
        const keyMetadata = keyMeta as KeyMetadata;
        keyMetadata.createdAt = new Date(keyMetadata.createdAt);
        if (keyMetadata.rotatedAt) {
          keyMetadata.rotatedAt = new Date(keyMetadata.rotatedAt);
        }
        
        this.keyMetadata.set(keyId, keyMetadata);
        
        // Derive key from master key and keyId
        const derivedKey = this.deriveKey(keyId);
        this.activeKeys.set(keyId, derivedKey);
      }
      
      logger.debug(`Loaded ${this.keyMetadata.size} encryption keys`);
    } catch (error) {
      // Initialize with default keys if metadata doesn't exist
      await this.initializeDefaultKeys();
    }
  }

  private async initializeDefaultKeys(): Promise<void> {
    const purposes: KeyMetadata['purpose'][] = ['data_encryption', 'session_encryption', 'backup_encryption'];
    
    for (const purpose of purposes) {
      await this.generateNewKey(purpose);
    }
    
    await this.saveKeyMetadata();
    logger.info('Initialized default encryption keys');
  }

  private async generateNewKey(purpose: KeyMetadata['purpose']): Promise<string> {
    const keyId = `${purpose}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const derivedKey = this.deriveKey(keyId);
    
    const metadata: KeyMetadata = {
      keyId,
      createdAt: new Date(),
      status: 'active',
      algorithm: this.config.algorithm,
      purpose
    };
    
    this.activeKeys.set(keyId, derivedKey);
    this.keyMetadata.set(keyId, metadata);
    
    return keyId;
  }

  private deriveKey(keyId: string): Buffer {
    if (!this.masterKey) {
      throw new Error('Master key not loaded');
    }
    
    // Use PBKDF2 to derive key from master key and keyId
    return crypto.pbkdf2Sync(this.masterKey, keyId, 100000, this.config.keyLength, 'sha256');
  }

  private getActiveKey(purpose: KeyMetadata['purpose']): Buffer {
    const keyId = this.getActiveKeyId(purpose);
    const key = this.activeKeys.get(keyId);
    
    if (!key) {
      throw new Error(`No active key found for purpose: ${purpose}`);
    }
    
    return key;
  }

  private getActiveKeyId(purpose: KeyMetadata['purpose']): string {
    let activeKeyId: string | null = null;
    let latestCreatedAt: Date | null = null;
    
    for (const [keyId, metadata] of this.keyMetadata) {
      if (metadata.purpose === purpose && metadata.status === 'active') {
        if (!latestCreatedAt || metadata.createdAt > latestCreatedAt) {
          activeKeyId = keyId;
          latestCreatedAt = metadata.createdAt;
        }
      }
    }
    
    if (!activeKeyId) {
      throw new Error(`No active key found for purpose: ${purpose}`);
    }
    
    return activeKeyId;
  }

  private async saveKeyMetadata(): Promise<void> {
    const keysMetadataPath = path.join(path.dirname(this.config.masterKeyPath), 'keys-metadata.json');
    const metadata = Object.fromEntries(this.keyMetadata);
    
    await fs.writeFile(keysMetadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
  }

  private startKeyRotation(): void {
    this.keyRotationTimer = setInterval(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        logger.error('Automatic key rotation failed:', error);
      }
    }, this.config.keyRotationIntervalMs);
    
    logger.info(`Started automatic key rotation every ${this.config.keyRotationIntervalMs}ms`);
  }

  private isPIIField(fieldName: string): boolean {
    const piiFields = [
      'ssn', 'social_security_number', 'tax_id', 'ein',
      'email', 'phone', 'telephone', 'mobile',
      'first_name', 'last_name', 'full_name', 'name',
      'address', 'street', 'city', 'zip', 'postal_code',
      'date_of_birth', 'dob', 'birth_date',
      'patient_id', 'member_id', 'subscriber_id',
      'license_number', 'npi', 'provider_id'
    ];
    
    return piiFields.some(pii => 
      fieldName.toLowerCase().includes(pii.toLowerCase())
    );
  }

  private anonymizeString(str: string): string {
    // SSN anonymization (specific pattern) - check this first
    if (/^\d{3}-?\d{2}-?\d{4}$/.test(str)) {
      return '***';
    }
    
    // Email anonymization
    if (str.includes('@')) {
      const [local, domain] = str.split('@');
      if (local && domain) {
        return `${local.substring(0, 2)}***@${domain}`;
      }
    }
    
    // Phone number anonymization
    if (/^\+?[\d\s\-\(\)]{10,}$/.test(str)) {
      return `***-***-${str.slice(-4)}`;
    }
    
    // General string anonymization
    if (str.length > 4) {
      return `${str.substring(0, 2)}***${str.slice(-2)}`;
    }
    
    return '***';
  }

  private anonymizeValue(value: any): any {
    if (typeof value === 'string') {
      return this.anonymizeString(value);
    }
    
    if (typeof value === 'number') {
      return '***';
    }
    
    return '***';
  }

  /**
   * Securely delete deprecated keys after grace period
   */
  public async cleanupDeprecatedKeys(gracePeriodDays: number = 30): Promise<number> {
    this.ensureInitialized();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);
    
    let cleanedCount = 0;
    const keysToRevoke: string[] = [];

    for (const [keyId, metadata] of this.keyMetadata) {
      if (metadata.status === 'deprecated' && 
          metadata.rotatedAt && 
          metadata.rotatedAt < cutoffDate) {
        keysToRevoke.push(keyId);
      }
    }

    for (const keyId of keysToRevoke) {
      // Mark as revoked instead of deleting immediately
      const metadata = this.keyMetadata.get(keyId);
      if (metadata) {
        metadata.status = 'revoked';
        this.activeKeys.delete(keyId);
        cleanedCount++;
        
        logger.info(`Revoked deprecated key ${keyId}`, {
          purpose: metadata.purpose,
          createdAt: metadata.createdAt,
          rotatedAt: metadata.rotatedAt
        });
      }
    }

    if (cleanedCount > 0) {
      await this.saveKeyMetadata();
      logger.info(`Cleaned up ${cleanedCount} deprecated keys`);
    }

    return cleanedCount;
  }

  /**
   * Backup key metadata before rotation
   */
  private async backupKeyMetadata(): Promise<void> {
    const backupPath = path.join(
      path.dirname(this.config.masterKeyPath), 
      `keys-metadata-backup-${Date.now()}.json`
    );
    
    const metadata = Object.fromEntries(this.keyMetadata);
    await fs.writeFile(backupPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
    
    logger.debug(`Key metadata backed up to ${backupPath}`);
  }

  /**
   * Restore key metadata from backup
   */
  private async restoreKeyMetadataFromBackup(): Promise<void> {
    const keysDir = path.dirname(this.config.masterKeyPath);
    
    try {
      const files = await fs.readdir(keysDir);
      const backupFiles = files
        .filter(f => f.startsWith('keys-metadata-backup-'))
        .sort()
        .reverse();
      
      if (backupFiles.length === 0) {
        throw new Error('No backup files found');
      }
      
      const latestBackup = path.join(keysDir, backupFiles[0]!);
      const backupContent = await fs.readFile(latestBackup, 'utf8');
      const metadata = JSON.parse(backupContent);
      
      this.keyMetadata.clear();
      for (const [keyId, keyMeta] of Object.entries(metadata)) {
        const keyMetadata = keyMeta as KeyMetadata;
        keyMetadata.createdAt = new Date(keyMetadata.createdAt);
        if (keyMetadata.rotatedAt) {
          keyMetadata.rotatedAt = new Date(keyMetadata.rotatedAt);
        }
        this.keyMetadata.set(keyId, keyMetadata);
      }
      
      logger.info(`Restored key metadata from backup: ${latestBackup}`);
    } catch (error) {
      logger.error('Failed to restore key metadata from backup:', error);
      throw error;
    }
  }

  /**
   * Verify key rotation was successful
   */
  private async verifyKeyRotation(
    rotationResults: { purpose: string; oldKeyId: string; newKeyId: string }[]
  ): Promise<void> {
    for (const result of rotationResults) {
      const purpose = result.purpose as KeyMetadata['purpose'];
      
      // Verify new key is active
      const activeKeyId = this.getActiveKeyId(purpose);
      if (activeKeyId !== result.newKeyId) {
        throw new Error(`Key rotation verification failed for ${purpose}: expected ${result.newKeyId}, got ${activeKeyId}`);
      }
      
      // Verify old key is deprecated
      const oldMetadata = this.keyMetadata.get(result.oldKeyId);
      if (!oldMetadata || oldMetadata.status !== 'deprecated') {
        throw new Error(`Old key ${result.oldKeyId} was not properly deprecated`);
      }
      
      // Test encryption/decryption with new key
      const testData = `test-${purpose}-${Date.now()}`;
      const encrypted = await this.encryptData(testData, purpose);
      const decrypted = await this.decryptData(encrypted);
      
      if (decrypted.toString('utf8') !== testData) {
        throw new Error(`Key rotation verification failed: encryption/decryption test failed for ${purpose}`);
      }
    }
    
    logger.debug('Key rotation verification completed successfully');
  }

  public shutdown(): void {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
      delete this.keyRotationTimer;
    }
    
    // Clear sensitive data from memory
    this.activeKeys.clear();
    this.masterKey = null;
    
    logger.info('SecurityManager shutdown complete');
  }
}