import * as fc from 'fast-check';
import { SecurityManager } from '@/services/SecurityManager';
import { DatabaseManager } from '@/services/DatabaseManager';
import { EpisodicMemory } from '@/services/EpisodicMemory';
import { EpisodicEntry } from '@/types/memory';
import { DataStateSnapshot } from '@/types/domain';

/**
 * Property 15: Data Encryption Completeness
 * **Validates: Requirements 11.1, 11.2**
 * 
 * For any data stored by the system, all persistent storage should use 
 * appropriate encryption at rest, and all communications should use TLS encryption.
 */

describe('Property 15: Data Encryption Completeness', () => {
  let securityManager: SecurityManager;
  let databaseManager: DatabaseManager;
  let episodicMemory: EpisodicMemory;

  beforeAll(async () => {
    // Initialize security components
    securityManager = SecurityManager.getInstance({
      masterKeyPath: './test-keys/master.key',
      keyRotationIntervalMs: 60000 // 1 minute for testing
    });
    
    databaseManager = DatabaseManager.getInstance();
    episodicMemory = new EpisodicMemory();
    
    await securityManager.initialize();
    await databaseManager.initialize();
    await episodicMemory.initialize();
  });

  afterAll(async () => {
    await databaseManager.close();
    securityManager.shutdown();
  });

  /**
   * Property: All sensitive data fields are encrypted when stored
   */
  test('should encrypt all sensitive data fields in persistent storage', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test data
        fc.record({
          sessionId: fc.uuid(),
          query: fc.string({ minLength: 10, maxLength: 500 }),
          response: fc.string({ minLength: 10, maxLength: 1000 }),
          confidence: fc.float({ min: 0, max: 1 }),
          toolsUsed: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
          reasoning: fc.array(fc.record({
            id: fc.uuid(),
            type: fc.constantFrom('analyze', 'query', 'search', 'correlate', 'conclude'),
            description: fc.string({ minLength: 5, maxLength: 100 }),
            toolsUsed: fc.array(fc.string(), { maxLength: 3 }),
            evidence: fc.array(fc.record({
              id: fc.uuid(),
              content: fc.string({ minLength: 5, maxLength: 200 }),
              sources: fc.array(fc.record({
                id: fc.uuid(),
                type: fc.constantFrom('csv_data', 'web_search', 'knowledge_base'),
                name: fc.string({ minLength: 3, maxLength: 50 }),
                timestamp: fc.date(),
                confidence: fc.float({ min: 0, max: 1 }),
                metadata: fc.record({})
              })),
              confidence: fc.float({ min: 0, max: 1 }),
              timestamp: fc.date(),
              type: fc.constantFrom('data_point', 'correlation', 'pattern', 'anomaly')
            })),
            timestamp: fc.date(),
            duration: fc.integer({ min: 0, max: 10000 }),
            confidence: fc.float({ min: 0, max: 1 })
          })),
          flags: fc.array(fc.record({
            id: fc.uuid(),
            type: fc.constantFrom('alert', 'warning', 'info', 'success'),
            category: fc.constantFrom('data_quality', 'performance', 'anomaly', 'regulatory'),
            message: fc.string({ minLength: 10, maxLength: 200 }),
            severity: fc.constantFrom(1, 2, 3, 4, 5),
            timestamp: fc.date(),
            resolved: fc.boolean(),
            source: fc.string({ minLength: 3, maxLength: 50 })
          })),
          dataState: fc.record({
            timestamp: fc.date(),
            rosterProcessingChecksum: fc.string({ minLength: 32, maxLength: 64 }),
            operationalMetricsChecksum: fc.string({ minLength: 32, maxLength: 64 }),
            totalRecords: fc.integer({ min: 0, max: 100000 }),
            lastModified: fc.date(),
            keyMetrics: fc.record({
              totalFiles: fc.integer({ min: 0, max: 10000 }),
              errorRate: fc.float({ min: 0, max: 1 }),
              avgProcessingTime: fc.integer({ min: 0, max: 3600 }),
              qualityScore: fc.float({ min: 0, max: 1 })
            })
          })
        }),
        async (testData) => {
          // Create episodic entry
          const entry: EpisodicEntry = {
            sessionId: testData.sessionId,
            timestamp: new Date(),
            query: testData.query,
            response: testData.response,
            confidence: testData.confidence,
            toolsUsed: testData.toolsUsed,
            reasoning: testData.reasoning,
            flags: testData.flags,
            dataState: testData.dataState as DataStateSnapshot
          };

          // Store the entry (should be encrypted)
          await episodicMemory.storeEntry(entry);

          // Verify that sensitive fields are encrypted in the database
          const rawRows = await databaseManager.executeSQLiteQuery(
            'SELECT * FROM episodic_entries WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1',
            [testData.sessionId]
          );

          expect(rawRows).toHaveLength(1);
          const rawRow = rawRows[0];

          // Verify that sensitive fields are encrypted (not plain text)
          expect(rawRow.query_encrypted).toBeDefined();
          expect(rawRow.response_encrypted).toBeDefined();
          expect(rawRow.reasoning_encrypted).toBeDefined();
          expect(rawRow.encryption_key_id).toBeDefined();

          // Verify that encrypted fields don't contain original plain text
          expect(rawRow.query_encrypted).not.toContain(testData.query);
          expect(rawRow.response_encrypted).not.toContain(testData.response);
          
          // Verify that encrypted data can be decrypted back to original
          const decryptedRows = await databaseManager.executeSQLiteQueryWithDecryption(
            'SELECT * FROM episodic_entries WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1',
            [testData.sessionId]
          );

          expect(decryptedRows).toHaveLength(1);
          const decryptedRow = decryptedRows[0];

          expect(decryptedRow.query).toBe(testData.query);
          expect(decryptedRow.response).toBe(testData.response);
          expect(JSON.parse(decryptedRow.reasoning)).toEqual(testData.reasoning);

          // Verify encryption key ID is valid
          const encryptionStats = securityManager.getEncryptionStats();
          expect(encryptionStats.activeKeys).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20, timeout: 30000 }
    );
  });

  /**
   * Property: Encryption keys are properly managed and rotated
   */
  test('should properly manage and rotate encryption keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 5, maxLength: 20 }),
        async (testStrings) => {
          const initialStats = securityManager.getEncryptionStats();
          
          // Encrypt multiple pieces of data
          const encryptedData = [];
          for (const str of testStrings) {
            const encrypted = await securityManager.encryptData(str, 'data_encryption');
            encryptedData.push({ original: str, encrypted });
          }

          // Verify all data was encrypted with valid keys
          for (const data of encryptedData) {
            expect(data.encrypted.keyId).toBeDefined();
            expect(data.encrypted.algorithm).toBe('aes-256-gcm');
            expect(data.encrypted.data).toBeDefined();
            expect(data.encrypted.iv).toBeDefined();
            expect(data.encrypted.tag).toBeDefined();
            expect(data.encrypted.timestamp).toBeInstanceOf(Date);
          }

          // Rotate keys
          await securityManager.rotateKeys();
          
          const postRotationStats = securityManager.getEncryptionStats();
          
          // Verify key rotation occurred
          expect(postRotationStats.deprecatedKeys).toBeGreaterThanOrEqual(initialStats.activeKeys);
          expect(postRotationStats.lastRotation).toBeDefined();

          // Verify old encrypted data can still be decrypted
          for (const data of encryptedData) {
            const decrypted = await securityManager.decryptData(data.encrypted);
            expect(decrypted.toString('utf8')).toBe(data.original);
          }

          // Verify new data uses new keys
          const newEncrypted = await securityManager.encryptData('test-after-rotation', 'data_encryption');
          expect(newEncrypted.keyId).toBeDefined();
          
          // New key should be different from old keys (unless by coincidence)
          const oldKeyIds = encryptedData.map(d => d.encrypted.keyId);
          const hasNewKey = !oldKeyIds.includes(newEncrypted.keyId);
          
          // This might occasionally fail due to key reuse, but should generally pass
          if (oldKeyIds.length > 0) {
            expect(hasNewKey).toBe(true);
          }
        }
      ),
      { numRuns: 5, timeout: 60000 }
    );
  });

  /**
   * Property: PII data is properly anonymized in logs
   */
  test('should anonymize PII data in logs and debug output', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          phone: fc.string({ minLength: 10, maxLength: 15 }).filter(s => /^\d+$/.test(s)),
          ssn: fc.string({ minLength: 9, maxLength: 11 }).filter(s => /^\d{3}-?\d{2}-?\d{4}$/.test(s)),
          firstName: fc.string({ minLength: 2, maxLength: 20 }),
          lastName: fc.string({ minLength: 2, maxLength: 20 }),
          address: fc.string({ minLength: 10, maxLength: 100 }),
          patientId: fc.string({ minLength: 5, maxLength: 20 }),
          regularData: fc.string({ minLength: 5, maxLength: 50 })
        }),
        async (piiData) => {
          // Anonymize the PII data
          const anonymized = securityManager.anonymizePII(piiData);

          // Verify that PII fields are anonymized
          expect(anonymized.email).not.toBe(piiData.email);
          expect(anonymized.email).toMatch(/^.{2}\*\*\*@/); // Email pattern

          expect(anonymized.phone).not.toBe(piiData.phone);
          expect(anonymized.phone).toMatch(/\*\*\*-\*\*\*-\d{4}$/); // Phone pattern

          expect(anonymized.ssn).not.toBe(piiData.ssn);
          expect(anonymized.ssn).toBe('***'); // Generic anonymization

          expect(anonymized.firstName).not.toBe(piiData.firstName);
          expect(anonymized.firstName).toMatch(/^.{2}\*\*\*.{2}$/); // Name pattern

          expect(anonymized.lastName).not.toBe(piiData.lastName);
          expect(anonymized.lastName).toMatch(/^.{2}\*\*\*.{2}$/); // Name pattern

          expect(anonymized.address).not.toBe(piiData.address);
          expect(anonymized.patientId).not.toBe(piiData.patientId);

          // Verify that non-PII data is preserved
          expect(anonymized.regularData).toBe(piiData.regularData);

          // Verify that original PII values are not present in anonymized output
          const anonymizedString = JSON.stringify(anonymized);
          expect(anonymizedString).not.toContain(piiData.email);
          expect(anonymizedString).not.toContain(piiData.phone);
          expect(anonymizedString).not.toContain(piiData.ssn);
          expect(anonymizedString).not.toContain(piiData.firstName);
          expect(anonymizedString).not.toContain(piiData.lastName);
          expect(anonymizedString).not.toContain(piiData.address);
          expect(anonymizedString).not.toContain(piiData.patientId);
        }
      ),
      { numRuns: 50, timeout: 10000 }
    );
  });

  /**
   * Property: Encryption is deterministic for integrity verification
   */
  test('should maintain data integrity through encryption/decryption cycles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 10000 }),
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          fc.record({
            text: fc.string(),
            number: fc.integer(),
            boolean: fc.boolean(),
            array: fc.array(fc.string()),
            nested: fc.record({
              value: fc.string(),
              count: fc.integer()
            })
          })
        ),
        async (originalData) => {
          const dataToEncrypt = typeof originalData === 'object' && !Buffer.isBuffer(originalData)
            ? JSON.stringify(originalData)
            : originalData;

          // Encrypt the data
          const encrypted = await securityManager.encryptData(dataToEncrypt, 'data_encryption');

          // Verify encryption metadata
          expect(encrypted.keyId).toBeDefined();
          expect(encrypted.algorithm).toBe('aes-256-cbc');
          expect(encrypted.data).toBeDefined();
          expect(encrypted.iv).toBeDefined();
          expect(encrypted.tag).toBeDefined();
          expect(encrypted.timestamp).toBeInstanceOf(Date);

          // Decrypt the data
          const decrypted = await securityManager.decryptData(encrypted);

          // Verify data integrity
          if (typeof originalData === 'string') {
            expect(decrypted.toString('utf8')).toBe(originalData);
          } else if (Buffer.isBuffer(originalData)) {
            expect(Buffer.compare(decrypted, originalData)).toBe(0);
          } else {
            expect(JSON.parse(decrypted.toString('utf8'))).toEqual(originalData);
          }

          // Verify that encrypted data is different from original
          const encryptedString = encrypted.data;
          const originalString = Buffer.isBuffer(originalData) 
            ? originalData.toString('base64')
            : typeof originalData === 'string' 
              ? originalData 
              : JSON.stringify(originalData);

          expect(encryptedString).not.toBe(originalString);

          // Generate hash for integrity verification
          const originalHash = securityManager.generateHash(dataToEncrypt);
          const decryptedHash = securityManager.generateHash(decrypted);
          expect(decryptedHash).toBe(originalHash);
        }
      ),
      { numRuns: 100, timeout: 30000 }
    );
  });

  /**
   * Property: TLS encryption is enforced for all communications
   */
  test('should enforce TLS 1.3 for all network communications', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hostname: fc.domain(),
          port: fc.integer({ min: 1000, max: 65535 }),
          path: fc.string({ minLength: 1, maxLength: 100 }).map(s => '/' + s.replace(/[^a-zA-Z0-9\/\-_]/g, '')),
          data: fc.string({ minLength: 10, maxLength: 1000 })
        }),
        async (connectionData) => {
          const TLSManager = (await import('@/services/TLSManager')).TLSManager;
          const tlsManager = TLSManager.getInstance();
          await tlsManager.initialize();

          // Get HTTPS options
          const httpsOptions = await tlsManager.getHTTPSOptions();
          
          // Verify TLS 1.3 configuration
          expect(httpsOptions.minVersion).toBe('TLSv1.3');
          expect(httpsOptions.maxVersion).toBe('TLSv1.3');
          expect(httpsOptions.ciphers).toContain('TLS_AES_256_GCM_SHA384');
          expect(httpsOptions.honorCipherOrder).toBe(true);

          // Create secure agent
          const secureAgent = tlsManager.createSecureAgent();
          expect(secureAgent).toBeDefined();

          // Verify TLS stats
          const tlsStats = tlsManager.getTLSStats();
          expect(tlsStats.tlsVersion).toBe('TLSv1.3');
          expect(tlsStats.supportedCiphers).toContain('TLS_AES_256_GCM_SHA384');
          expect(tlsStats.supportedCiphers).toContain('TLS_CHACHA20_POLY1305_SHA256');
          expect(tlsStats.supportedCiphers).toContain('TLS_AES_128_GCM_SHA256');

          tlsManager.shutdown();
        }
      ),
      { numRuns: 10, timeout: 15000 }
    );
  });

  /**
   * Property: Key rotation maintains data accessibility
   */
  test('should maintain data accessibility across multiple key rotations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            data: fc.string({ minLength: 5, maxLength: 200 }),
            purpose: fc.constantFrom('data_encryption', 'session_encryption', 'backup_encryption')
          }),
          { minLength: 10, maxLength: 50 }
        ),
        async (testDataArray) => {
          const encryptedDataSets: Array<{
            original: string;
            encrypted: any;
            purpose: string;
            rotationRound: number;
          }> = [];

          // Encrypt data across multiple rotation rounds
          for (let round = 0; round < 3; round++) {
            // Encrypt some data
            for (const testData of testDataArray.slice(round * 5, (round + 1) * 5)) {
              const encrypted = await securityManager.encryptData(
                testData.data, 
                testData.purpose as any
              );
              
              encryptedDataSets.push({
                original: testData.data,
                encrypted,
                purpose: testData.purpose,
                rotationRound: round
              });
            }

            // Rotate keys after each round (except the last)
            if (round < 2) {
              await securityManager.rotateKeys();
            }
          }

          // Verify all data from all rounds can still be decrypted
          for (const dataSet of encryptedDataSets) {
            const decrypted = await securityManager.decryptData(dataSet.encrypted);
            expect(decrypted.toString('utf8')).toBe(dataSet.original);
          }

          // Verify encryption stats show proper key management
          const stats = securityManager.getEncryptionStats();
          expect(stats.activeKeys).toBeGreaterThan(0);
          expect(stats.deprecatedKeys).toBeGreaterThan(0);
          expect(stats.lastRotation).toBeDefined();
        }
      ),
      { numRuns: 3, timeout: 120000 }
    );
  });

  /**
   * Property: File encryption maintains data integrity
   */
  test('should maintain file integrity through encryption/decryption', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          filename: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '_')),
          content: fc.string({ minLength: 100, maxLength: 5000 })
        }),
        async (fileData) => {
          const testDir = './test-encryption';
          const originalPath = `${testDir}/${fileData.filename}.txt`;
          const encryptedPath = `${testDir}/${fileData.filename}.encrypted`;
          const decryptedPath = `${testDir}/${fileData.filename}.decrypted.txt`;

          // Ensure test directory exists
          const fs = require('fs/promises');
          await fs.mkdir(testDir, { recursive: true });

          try {
            // Write original file
            await fs.writeFile(originalPath, fileData.content);

            // Encrypt file
            await securityManager.encryptFile(originalPath, encryptedPath, 'data_encryption');

            // Verify encrypted file exists and is different
            const encryptedContent = await fs.readFile(encryptedPath, 'utf8');
            expect(encryptedContent).toBeDefined();
            expect(encryptedContent).not.toBe(fileData.content);

            // Verify encrypted file contains metadata
            const encryptedData = JSON.parse(encryptedContent);
            expect(encryptedData.data).toBeDefined();
            expect(encryptedData.iv).toBeDefined();
            expect(encryptedData.tag).toBeDefined();
            expect(encryptedData.keyId).toBeDefined();
            expect(encryptedData.algorithm).toBe('aes-256-cbc');

            // Decrypt file
            await securityManager.decryptFile(encryptedPath, decryptedPath);

            // Verify decrypted content matches original
            const decryptedContent = await fs.readFile(decryptedPath, 'utf8');
            expect(decryptedContent).toBe(fileData.content);

            // Generate hashes for integrity verification
            const originalHash = securityManager.generateHash(fileData.content);
            const decryptedHash = securityManager.generateHash(decryptedContent);
            expect(decryptedHash).toBe(originalHash);

          } finally {
            // Cleanup test files
            try {
              await fs.unlink(originalPath);
              await fs.unlink(encryptedPath);
              await fs.unlink(decryptedPath);
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10, timeout: 30000 }
    );
  });
});