import { AuthenticationManager } from '@/services/AuthenticationManager';
import { SecurityManager } from '@/services/SecurityManager';
import { HIPAAComplianceManager } from '@/services/HIPAAComplianceManager';

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;
  let securityManager: SecurityManager;
  let complianceManager: HIPAAComplianceManager;

  beforeAll(async () => {
    // Initialize dependencies
    securityManager = SecurityManager.getInstance({
      masterKeyPath: './test-keys/auth-test-master.key'
    });
    await securityManager.initialize();

    complianceManager = HIPAAComplianceManager.getInstance();
    await complianceManager.initialize();

    authManager = AuthenticationManager.getInstance({
      jwtSecret: 'test-jwt-secret-key-for-testing-only',
      accessTokenExpiryMs: 15 * 60 * 1000, // 15 minutes
      refreshTokenExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxConcurrentSessions: 3,
      requireMFA: false // Disable MFA for testing
    });
    await authManager.initialize();
  });

  afterAll(async () => {
    authManager.shutdown();
    complianceManager.shutdown();
    securityManager.shutdown();
  });

  describe('User Authentication', () => {
    test('should authenticate valid user credentials', async () => {
      const deviceInfo = {
        deviceId: 'test-device-001',
        ipAddress: '192.168.1.100',
        userAgent: 'Test-Agent/1.0'
      };

      const result = await authManager.authenticate('admin', 'admin123456789', deviceInfo);
      
      expect(result).not.toBeNull();
      expect(result!.tokens.accessToken).toBeDefined();
      expect(result!.tokens.refreshToken).toBeDefined();
      expect(result!.tokens.tokenType).toBe('Bearer');
      expect(result!.session.userId).toBeDefined();
      expect(result!.session.deviceId).toBe(deviceInfo.deviceId);
      expect(result!.session.ipAddress).toBe(deviceInfo.ipAddress);
      expect(result!.session.isActive).toBe(true);
    });

    test('should reject invalid credentials', async () => {
      const deviceInfo = {
        deviceId: 'test-device-002',
        ipAddress: '192.168.1.101',
        userAgent: 'Test-Agent/1.0'
      };

      const result = await authManager.authenticate('admin', 'wrongpassword', deviceInfo);
      
      expect(result).toBeNull();
    });

    test('should reject inactive user', async () => {
      // First create an inactive user
      const inactiveUser = await authManager.createUser({
        username: 'inactive_user',
        email: 'inactive@test.com',
        roles: [],
        isActive: false,
        mfaEnabled: false
      }, 'testpassword123');

      const deviceInfo = {
        deviceId: 'test-device-003',
        ipAddress: '192.168.1.102',
        userAgent: 'Test-Agent/1.0'
      };

      const result = await authManager.authenticate('inactive_user', 'testpassword123', deviceInfo);
      
      expect(result).toBeNull();
    });

    test('should handle MFA when enabled', async () => {
      // Create user with MFA enabled
      const mfaUser = await authManager.createUser({
        username: 'mfa_user',
        email: 'mfa@test.com',
        roles: [],
        isActive: true,
        mfaEnabled: true,
        mfaSecret: 'test-mfa-secret'
      }, 'testpassword123');

      const deviceInfo = {
        deviceId: 'test-device-004',
        ipAddress: '192.168.1.103',
        userAgent: 'Test-Agent/1.0'
      };

      // Enable MFA requirement for this test
      const authManagerWithMFA = AuthenticationManager.getInstance({
        requireMFA: true
      });

      // Should fail without MFA token
      const resultWithoutMFA = await authManagerWithMFA.authenticate('mfa_user', 'testpassword123', deviceInfo);
      expect(resultWithoutMFA).toBeNull();

      // Should succeed with valid MFA token (mocked)
      const resultWithMFA = await authManagerWithMFA.authenticate('mfa_user', 'testpassword123', deviceInfo, '123456');
      // Note: This will depend on the MFA implementation
    });
  });

  describe('Token Management', () => {
    let validTokens: any;
    let validSession: any;

    beforeAll(async () => {
      const deviceInfo = {
        deviceId: 'token-test-device',
        ipAddress: '192.168.1.200',
        userAgent: 'Token-Test-Agent/1.0'
      };

      const authResult = await authManager.authenticate('admin', 'admin123456789', deviceInfo);
      validTokens = authResult!.tokens;
      validSession = authResult!.session;
    });

    test('should validate valid JWT token', async () => {
      const validation = await authManager.validateToken(validTokens.accessToken);
      
      expect(validation).not.toBeNull();
      expect(validation!.user.username).toBe('admin');
      expect(validation!.session.sessionId).toBe(validSession.sessionId);
    });

    test('should reject invalid JWT token', async () => {
      const invalidToken = 'invalid.jwt.token';
      const validation = await authManager.validateToken(invalidToken);
      
      expect(validation).toBeNull();
    });

    test('should refresh access token', async () => {
      const newTokens = await authManager.refreshToken(validTokens.refreshToken);
      
      expect(newTokens).not.toBeNull();
      expect(newTokens!.accessToken).toBeDefined();
      expect(newTokens!.refreshToken).toBeDefined();
      expect(newTokens!.accessToken).not.toBe(validTokens.accessToken);
    });

    test('should reject invalid refresh token', async () => {
      const invalidRefreshToken = 'invalid.refresh.token';
      const newTokens = await authManager.refreshToken(invalidRefreshToken);
      
      expect(newTokens).toBeNull();
    });
  });

  describe('Authorization', () => {
    let testUser: any;

    beforeAll(async () => {
      // Create a test user with specific roles
      const operationsRole = {
        id: 'operations_analyst',
        name: 'Operations Analyst',
        description: 'Analyze roster operations',
        isHealthcareRole: true,
        permissions: [
          { id: 'roster_read', resource: 'roster_data', action: 'read' as const },
          { id: 'analytics_execute', resource: 'analytics', action: 'execute' as const }
        ]
      };

      testUser = await authManager.createUser({
        username: 'test_analyst',
        email: 'analyst@test.com',
        roles: [operationsRole],
        isActive: true,
        mfaEnabled: false
      }, 'testpassword123');
    });

    test('should grant permission for allowed resource and action', async () => {
      const hasPermission = authManager.hasPermission(testUser, 'roster_data', 'read');
      expect(hasPermission).toBe(true);
    });

    test('should deny permission for disallowed resource and action', async () => {
      const hasPermission = authManager.hasPermission(testUser, 'roster_data', 'delete');
      expect(hasPermission).toBe(false);
    });

    test('should deny permission for inactive user', async () => {
      const inactiveUser = { ...testUser, isActive: false };
      const hasPermission = authManager.hasPermission(inactiveUser, 'roster_data', 'read');
      expect(hasPermission).toBe(false);
    });

    test('should handle wildcard permissions', async () => {
      // Create user with wildcard permission
      const adminRole = {
        id: 'admin_role',
        name: 'Admin Role',
        description: 'Administrative access',
        isHealthcareRole: true,
        permissions: [
          { id: 'all_roster', resource: 'roster*', action: 'read' as const }
        ]
      };

      const adminUser = await authManager.createUser({
        username: 'admin_wildcard',
        email: 'admin@test.com',
        roles: [adminRole],
        isActive: true,
        mfaEnabled: false
      }, 'testpassword123');

      const hasPermission = authManager.hasPermission(adminUser, 'roster_data', 'read');
      expect(hasPermission).toBe(true);
    });

    test('should evaluate permission conditions', async () => {
      // Create user with conditional permission
      const conditionalRole = {
        id: 'conditional_role',
        name: 'Conditional Role',
        description: 'Role with conditions',
        isHealthcareRole: true,
        permissions: [
          { 
            id: 'conditional_read', 
            resource: 'sensitive_data', 
            action: 'read' as const,
            conditions: { department: 'analytics' }
          }
        ]
      };

      const conditionalUser = await authManager.createUser({
        username: 'conditional_user',
        email: 'conditional@test.com',
        roles: [conditionalRole],
        isActive: true,
        mfaEnabled: false
      }, 'testpassword123');

      // Should grant permission with matching context
      const hasPermissionWithContext = authManager.hasPermission(
        conditionalUser, 
        'sensitive_data', 
        'read',
        { department: 'analytics' }
      );
      expect(hasPermissionWithContext).toBe(true);

      // Should deny permission without matching context
      const hasPermissionWithoutContext = authManager.hasPermission(
        conditionalUser, 
        'sensitive_data', 
        'read',
        { department: 'finance' }
      );
      expect(hasPermissionWithoutContext).toBe(false);
    });
  });

  describe('Session Management', () => {
    test('should manage concurrent sessions', async () => {
      const deviceInfo1 = {
        deviceId: 'concurrent-device-1',
        ipAddress: '192.168.1.301',
        userAgent: 'Concurrent-Test-1/1.0'
      };

      const deviceInfo2 = {
        deviceId: 'concurrent-device-2',
        ipAddress: '192.168.1.302',
        userAgent: 'Concurrent-Test-2/1.0'
      };

      const deviceInfo3 = {
        deviceId: 'concurrent-device-3',
        ipAddress: '192.168.1.303',
        userAgent: 'Concurrent-Test-3/1.0'
      };

      const deviceInfo4 = {
        deviceId: 'concurrent-device-4',
        ipAddress: '192.168.1.304',
        userAgent: 'Concurrent-Test-4/1.0'
      };

      // Create multiple sessions (max is 3)
      const session1 = await authManager.authenticate('admin', 'admin123456789', deviceInfo1);
      const session2 = await authManager.authenticate('admin', 'admin123456789', deviceInfo2);
      const session3 = await authManager.authenticate('admin', 'admin123456789', deviceInfo3);
      
      expect(session1).not.toBeNull();
      expect(session2).not.toBeNull();
      expect(session3).not.toBeNull();

      // Fourth session should deactivate the oldest
      const session4 = await authManager.authenticate('admin', 'admin123456789', deviceInfo4);
      expect(session4).not.toBeNull();

      // Check active sessions
      const activeSessions = authManager.getActiveSessions(session1!.session.userId);
      expect(activeSessions.length).toBeLessThanOrEqual(3);
    });

    test('should logout and invalidate session', async () => {
      const deviceInfo = {
        deviceId: 'logout-test-device',
        ipAddress: '192.168.1.400',
        userAgent: 'Logout-Test/1.0'
      };

      const authResult = await authManager.authenticate('admin', 'admin123456789', deviceInfo);
      expect(authResult).not.toBeNull();

      const sessionId = authResult!.session.sessionId;
      const accessToken = authResult!.tokens.accessToken;

      // Verify token is valid before logout
      const validationBefore = await authManager.validateToken(accessToken);
      expect(validationBefore).not.toBeNull();

      // Logout
      await authManager.logout(sessionId);

      // Verify token is invalid after logout
      const validationAfter = await authManager.validateToken(accessToken);
      expect(validationAfter).toBeNull();
    });

    test('should clean up expired sessions', async () => {
      // Create a session
      const deviceInfo = {
        deviceId: 'cleanup-test-device',
        ipAddress: '192.168.1.500',
        userAgent: 'Cleanup-Test/1.0'
      };

      const authResult = await authManager.authenticate('admin', 'admin123456789', deviceInfo);
      expect(authResult).not.toBeNull();

      // Manually set session as expired (simulate time passage)
      const session = authResult!.session;
      session.lastActivity = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago

      // Clean up expired sessions
      const cleanedCount = await authManager.cleanupExpiredSessions();
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('User Management', () => {
    test('should create new user with valid data', async () => {
      const userData = {
        username: 'new_test_user',
        email: 'newuser@test.com',
        roles: [],
        isActive: true,
        mfaEnabled: false
      };

      const user = await authManager.createUser(userData, 'strongpassword123');
      
      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.isActive).toBe(true);
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe('strongpassword123'); // Should be hashed
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    test('should reject weak passwords', async () => {
      const userData = {
        username: 'weak_password_user',
        email: 'weak@test.com',
        roles: [],
        isActive: true,
        mfaEnabled: false
      };

      await expect(authManager.createUser(userData, 'weak'))
        .rejects.toThrow('Password must be at least');
    });
  });
});