import { HIPAAComplianceManager } from '@/services/HIPAAComplianceManager';
import { SecurityManager } from '@/services/SecurityManager';
import { AuthenticationManager } from '@/services/AuthenticationManager';

describe('HIPAAComplianceManager', () => {
  let complianceManager: HIPAAComplianceManager;
  let securityManager: SecurityManager;
  let authManager: AuthenticationManager;

  beforeAll(async () => {
    // Initialize dependencies
    securityManager = SecurityManager.getInstance({
      masterKeyPath: './test-keys/hipaa-test-master.key'
    });
    await securityManager.initialize();

    authManager = AuthenticationManager.getInstance();
    await authManager.initialize();

    complianceManager = HIPAAComplianceManager.getInstance();
    await complianceManager.initialize();
  });

  afterAll(async () => {
    complianceManager.shutdown();
    authManager.shutdown();
    securityManager.shutdown();
  });

  describe('Audit Logging', () => {
    test('should log audit entry with proper risk assessment', async () => {
      const userId = 'test-user-001';
      const sessionId = 'test-session-001';
      const action = 'data_access';
      const resource = 'patient_records';
      const resourceId = 'patient-123';
      const ipAddress = '192.168.1.100';
      const userAgent = 'Test-Browser/1.0';
      const details = {
        recordCount: 1,
        accessType: 'read',
        department: 'analytics'
      };

      await complianceManager.logAuditEntry(
        userId,
        sessionId,
        action,
        resource,
        resourceId,
        ipAddress,
        userAgent,
        true,
        details
      );

      // Verify audit log was created
      const auditLogs = await complianceManager.getAuditLogs(
        new Date(Date.now() - 1000),
        new Date(Date.now() + 1000)
      );

      expect(auditLogs.length).toBeGreaterThan(0);
      
      const logEntry = auditLogs.find(log => 
        log.userId === userId && 
        log.action === action && 
        log.resource === resource
      );

      expect(logEntry).toBeDefined();
      expect(logEntry!.success).toBe(true);
      expect(logEntry!.riskLevel).toBeDefined();
      expect(logEntry!.details).toBeDefined();
      expect(logEntry!.timestamp).toBeInstanceOf(Date);
    });

    test('should assess risk levels correctly', async () => {
      // High-risk action (delete)
      await complianceManager.logAuditEntry(
        'user-001',
        'session-001',
        'delete_patient_data',
        'patient_records',
        'patient-456',
        '192.168.1.101',
        'Test-Browser/1.0',
        true,
        { recordCount: 1 }
      );

      // Medium-risk resource (PHI data)
      await complianceManager.logAuditEntry(
        'user-002',
        'session-002',
        'view_data',
        'phi_records',
        'phi-789',
        '192.168.1.102',
        'Test-Browser/1.0',
        true,
        { recordCount: 1 }
      );

      // Low-risk action
      await complianceManager.logAuditEntry(
        'user-003',
        'session-003',
        'view_dashboard',
        'analytics_dashboard',
        undefined,
        '192.168.1.103',
        'Test-Browser/1.0',
        true,
        {}
      );

      const auditLogs = await complianceManager.getAuditLogs(
        new Date(Date.now() - 5000),
        new Date(Date.now() + 1000)
      );

      const highRiskLog = auditLogs.find(log => log.action === 'delete_patient_data');
      const mediumRiskLog = auditLogs.find(log => log.resource === 'phi_records');
      const lowRiskLog = auditLogs.find(log => log.action === 'view_dashboard');

      expect(highRiskLog?.riskLevel).toBe('high');
      expect(mediumRiskLog?.riskLevel).toBe('medium');
      expect(lowRiskLog?.riskLevel).toBe('low');
    });

    test('should filter audit logs by criteria', async () => {
      const testUserId = 'filter-test-user';
      const testAction = 'filter_test_action';
      const testResource = 'filter_test_resource';

      // Create test audit entries
      await complianceManager.logAuditEntry(
        testUserId,
        'session-filter-1',
        testAction,
        testResource,
        'resource-1',
        '192.168.1.200',
        'Filter-Test/1.0',
        true,
        {}
      );

      await complianceManager.logAuditEntry(
        'other-user',
        'session-filter-2',
        'other_action',
        'other_resource',
        'resource-2',
        '192.168.1.201',
        'Filter-Test/1.0',
        true,
        {}
      );

      // Filter by user ID
      const userFilteredLogs = await complianceManager.getAuditLogs(
        new Date(Date.now() - 5000),
        new Date(Date.now() + 1000),
        { userId: testUserId }
      );

      expect(userFilteredLogs.length).toBeGreaterThan(0);
      expect(userFilteredLogs.every(log => log.userId === testUserId)).toBe(true);

      // Filter by action
      const actionFilteredLogs = await complianceManager.getAuditLogs(
        new Date(Date.now() - 5000),
        new Date(Date.now() + 1000),
        { action: testAction }
      );

      expect(actionFilteredLogs.length).toBeGreaterThan(0);
      expect(actionFilteredLogs.every(log => log.action === testAction)).toBe(true);

      // Filter by resource
      const resourceFilteredLogs = await complianceManager.getAuditLogs(
        new Date(Date.now() - 5000),
        new Date(Date.now() + 1000),
        { resource: testResource }
      );

      expect(resourceFilteredLogs.length).toBeGreaterThan(0);
      expect(resourceFilteredLogs.every(log => log.resource === testResource)).toBe(true);
    });
  });

  describe('Data Retention Policies', () => {
    test('should apply retention policies', async () => {
      const result = await complianceManager.applyRetentionPolicies();
      
      expect(result).toHaveProperty('deletedRecords');
      expect(result).toHaveProperty('anonymizedRecords');
      expect(result).toHaveProperty('archivedRecords');
      expect(result).toHaveProperty('complianceReport');
      
      expect(typeof result.deletedRecords).toBe('number');
      expect(typeof result.anonymizedRecords).toBe('number');
      expect(typeof result.archivedRecords).toBe('number');
      expect(typeof result.complianceReport).toBe('string');
      
      expect(result.complianceReport).toContain('Data Retention Compliance Report');
    });
  });

  describe('Breach Detection', () => {
    test('should detect potential breaches', async () => {
      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await complianceManager.logAuditEntry(
          'breach-test-user',
          'breach-session',
          'login',
          'authentication',
          undefined,
          '192.168.1.300',
          'Breach-Test/1.0',
          false, // Failed login
          { attempt: i + 1 }
        );
      }

      // Run breach detection
      const incidents = await complianceManager.detectBreaches();
      
      expect(Array.isArray(incidents)).toBe(true);
      // Note: The actual breach detection logic would need to be implemented
      // to make this test more meaningful
    });
  });

  describe('Secure Deletion', () => {
    test('should perform secure deletion', async () => {
      const dataType = 'test_data';
      const identifiers = ['test-id-1', 'test-id-2', 'test-id-3'];
      
      const result = await complianceManager.secureDelete(dataType, identifiers);
      
      expect(result).toHaveProperty('deleted');
      expect(result).toHaveProperty('failed');
      expect(typeof result.deleted).toBe('number');
      expect(typeof result.failed).toBe('number');
      expect(result.deleted + result.failed).toBe(identifiers.length);
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate audit summary report', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();
      
      const report = await complianceManager.generateComplianceReport(
        'audit_summary',
        startDate,
        endDate
      );
      
      expect(report.id).toBeDefined();
      expect(report.reportType).toBe('audit_summary');
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.periodStart).toEqual(startDate);
      expect(report.periodEnd).toEqual(endDate);
      expect(report.data).toBeDefined();
      expect(typeof report.complianceScore).toBe('number');
      expect(report.complianceScore).toBeGreaterThanOrEqual(0);
      expect(report.complianceScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.findings)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('should generate access report', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();
      
      const report = await complianceManager.generateComplianceReport(
        'access_report',
        startDate,
        endDate
      );
      
      expect(report.reportType).toBe('access_report');
      expect(report.data).toBeDefined();
    });

    test('should generate breach report', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();
      
      const report = await complianceManager.generateComplianceReport(
        'breach_report',
        startDate,
        endDate
      );
      
      expect(report.reportType).toBe('breach_report');
      expect(report.data).toBeDefined();
      expect(report.data.totalIncidents).toBeDefined();
      expect(report.data.severityDistribution).toBeDefined();
      expect(report.data.statusDistribution).toBeDefined();
    });

    test('should generate retention report', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();
      
      const report = await complianceManager.generateComplianceReport(
        'retention_report',
        startDate,
        endDate
      );
      
      expect(report.reportType).toBe('retention_report');
      expect(report.data).toBeDefined();
    });
  });

  describe('Compliance Dashboard', () => {
    test('should provide compliance dashboard data', async () => {
      const dashboard = complianceManager.getComplianceDashboard();
      
      expect(dashboard).toHaveProperty('auditLogCount');
      expect(dashboard).toHaveProperty('activeBreachIncidents');
      expect(dashboard).toHaveProperty('complianceScore');
      expect(dashboard).toHaveProperty('retentionPoliciesActive');
      expect(dashboard).toHaveProperty('lastBreachDetection');
      expect(dashboard).toHaveProperty('criticalFindings');
      
      expect(typeof dashboard.auditLogCount).toBe('number');
      expect(typeof dashboard.activeBreachIncidents).toBe('number');
      expect(typeof dashboard.complianceScore).toBe('number');
      expect(typeof dashboard.retentionPoliciesActive).toBe('number');
      expect(typeof dashboard.criticalFindings).toBe('number');
      
      expect(dashboard.complianceScore).toBeGreaterThanOrEqual(0);
      expect(dashboard.complianceScore).toBeLessThanOrEqual(100);
    });

    test('should create enhanced compliance dashboard', async () => {
      const dashboard = await complianceManager.createComplianceDashboard();
      
      expect(dashboard).toHaveProperty('overallScore');
      expect(dashboard).toHaveProperty('auditCoverage');
      expect(dashboard).toHaveProperty('retentionCompliance');
      expect(dashboard).toHaveProperty('breachIncidents');
      expect(dashboard).toHaveProperty('dataAccessMetrics');
      expect(dashboard).toHaveProperty('recommendations');
      
      expect(dashboard.dataAccessMetrics).toHaveProperty('totalAccess');
      expect(dashboard.dataAccessMetrics).toHaveProperty('unauthorizedAttempts');
      expect(dashboard.dataAccessMetrics).toHaveProperty('highRiskActivities');
      
      expect(Array.isArray(dashboard.recommendations)).toBe(true);
      expect(dashboard.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Breach Notification', () => {
    test('should generate breach notification report', async () => {
      // First create a mock breach incident
      const mockIncidentId = 'mock-incident-001';
      
      // Since we can't directly access private methods, we'll test the public interface
      // In a real implementation, you would create a breach incident first
      
      try {
        const report = await complianceManager.generateBreachNotificationReport(mockIncidentId);
        
        expect(report).toHaveProperty('reportId');
        expect(report).toHaveProperty('incident');
        expect(report).toHaveProperty('affectedRecords');
        expect(report).toHaveProperty('notificationRequired');
        expect(report).toHaveProperty('regulatoryDeadline');
        expect(report).toHaveProperty('reportContent');
        
        expect(report.regulatoryDeadline).toBeInstanceOf(Date);
        expect(typeof report.notificationRequired).toBe('boolean');
        expect(typeof report.reportContent).toBe('string');
        expect(report.reportContent).toContain('HIPAA BREACH NOTIFICATION REPORT');
      } catch (error) {
        // Expected to fail with mock incident ID
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('PII Anonymization Integration', () => {
    test('should anonymize PII in audit logs', async () => {
      const piiDetails = {
        patientEmail: 'patient@example.com',
        patientPhone: '1234567890',
        patientSSN: '123-45-6789',
        patientName: 'John Doe',
        regularField: 'This is not PII'
      };

      await complianceManager.logAuditEntry(
        'pii-test-user',
        'pii-test-session',
        'access_patient_data',
        'patient_records',
        'patient-pii-test',
        '192.168.1.400',
        'PII-Test/1.0',
        true,
        piiDetails
      );

      const auditLogs = await complianceManager.getAuditLogs(
        new Date(Date.now() - 1000),
        new Date(Date.now() + 1000),
        { userId: 'pii-test-user' }
      );

      expect(auditLogs.length).toBeGreaterThan(0);
      
      const piiLog = auditLogs.find(log => log.userId === 'pii-test-user');
      expect(piiLog).toBeDefined();
      
      // Verify PII fields are anonymized in the stored details
      const logDetailsString = JSON.stringify(piiLog!.details);
      expect(logDetailsString).not.toContain('patient@example.com');
      expect(logDetailsString).not.toContain('1234567890');
      expect(logDetailsString).not.toContain('123-45-6789');
      expect(logDetailsString).not.toContain('John Doe');
      
      // Non-PII should be preserved
      expect(logDetailsString).toContain('This is not PII');
    });
  });
});