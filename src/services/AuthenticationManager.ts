import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import { SecurityManager } from './SecurityManager';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  description: string;
  isHealthcareRole: boolean;
}

export interface Permission {
  id: string;
  resource: string;
  action: 'read' | 'write' | 'delete' | 'execute' | 'admin';
  conditions?: Record<string, any>;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType: 'Bearer';
  scope: string[];
}

export interface Session {
  sessionId: string;
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  permissions: Permission[];
}

export interface AuthConfig {
  jwtSecret: string;
  accessTokenExpiryMs: number;
  refreshTokenExpiryMs: number;
  maxConcurrentSessions: number;
  passwordMinLength: number;
  requireMFA: boolean;
  sessionTimeoutMs: number;
}

/**
 * AuthenticationManager - JWT-based authentication with RBAC
 * 
 * Implements secure authentication, role-based access control,
 * session management, and audit logging for healthcare compliance.
 */
export class AuthenticationManager {
  private static instance: AuthenticationManager;
  private config: AuthConfig;
  private securityManager: SecurityManager;
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private refreshTokens: Map<string, string> = new Map(); // refreshToken -> userId
  private roles: Map<string, Role> = new Map();
  private initialized = false;

  private constructor(config?: Partial<AuthConfig>) {
    this.config = {
      jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
      accessTokenExpiryMs: 15 * 60 * 1000, // 15 minutes
      refreshTokenExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxConcurrentSessions: 5,
      passwordMinLength: 12,
      requireMFA: true,
      sessionTimeoutMs: 2 * 60 * 60 * 1000, // 2 hours
      ...config
    };
    
    this.securityManager = SecurityManager.getInstance();
  }

  public static getInstance(config?: Partial<AuthConfig>): AuthenticationManager {
    if (!AuthenticationManager.instance) {
      AuthenticationManager.instance = new AuthenticationManager(config);
    }
    return AuthenticationManager.instance;
  }
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.securityManager.initialize();
      await this.loadDefaultRoles();
      await this.loadUsers();
      
      this.initialized = true;
      logger.info('AuthenticationManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AuthenticationManager:', error);
      throw error;
    }
  }

  /**
   * Enhanced JWT authentication with refresh token support and concurrent session handling
   */
  public async authenticate(
    username: string, 
    password: string,
    deviceInfo: { deviceId: string; ipAddress: string; userAgent: string },
    mfaToken?: string
  ): Promise<{ tokens: AuthToken; session: Session } | null> {
    this.ensureInitialized();

    try {
      const user = this.findUserByUsername(username);
      if (!user || !user.isActive) {
        await this.logSecurityEvent('authentication_failed', { username, reason: 'user_not_found' });
        return null;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        await this.logSecurityEvent('authentication_failed', { username, reason: 'invalid_password' });
        return null;
      }

      // Check MFA if enabled
      if (user.mfaEnabled && this.config.requireMFA) {
        if (!mfaToken || !this.verifyMFAToken(user.mfaSecret!, mfaToken)) {
          await this.logSecurityEvent('authentication_failed', { username, reason: 'invalid_mfa' });
          return null;
        }
      }

      // Handle concurrent session limits
      await this.manageConcurrentSessions(user.id, deviceInfo);

      // Create session with enhanced security
      const session = await this.createSession(user, deviceInfo);
      
      // Generate tokens with enhanced claims
      const tokens = await this.generateTokens(user, session);

      // Update last login and security metrics
      user.lastLogin = new Date();
      await this.updateUserSecurityMetrics(user.id, 'successful_login');

      await this.logSecurityEvent('authentication_success', { 
        userId: user.id, 
        sessionId: session.sessionId,
        deviceId: deviceInfo.deviceId,
        ipAddress: deviceInfo.ipAddress
      });

      return { tokens, session };
    } catch (error) {
      logger.error('Authentication error:', error);
      await this.logSecurityEvent('authentication_error', { username, error: error.message });
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshToken(refreshToken: string): Promise<AuthToken | null> {
    this.ensureInitialized();

    try {
      const userId = this.refreshTokens.get(refreshToken);
      if (!userId) {
        await this.logSecurityEvent('token_refresh_failed', { reason: 'invalid_refresh_token' });
        return null;
      }

      const user = this.users.get(userId);
      if (!user || !user.isActive) {
        await this.logSecurityEvent('token_refresh_failed', { userId, reason: 'user_inactive' });
        return null;
      }

      // Find active session for this user
      const session = Array.from(this.sessions.values())
        .find(s => s.userId === userId && s.isActive);
      
      if (!session) {
        await this.logSecurityEvent('token_refresh_failed', { userId, reason: 'no_active_session' });
        return null;
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user, session);

      // Remove old refresh token and add new one
      this.refreshTokens.delete(refreshToken);
      this.refreshTokens.set(tokens.refreshToken, userId);

      await this.logSecurityEvent('token_refreshed', { userId, sessionId: session.sessionId });

      return tokens;
    } catch (error) {
      logger.error('Token refresh error:', error);
      await this.logSecurityEvent('token_refresh_error', { error: error.message });
      return null;
    }
  }

  /**
   * Validate JWT access token
   */
  public async validateToken(token: string): Promise<{ user: User; session: Session } | null> {
    this.ensureInitialized();

    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      
      const user = this.users.get(decoded.userId);
      const session = this.sessions.get(decoded.sessionId);

      if (!user || !session || !user.isActive || !session.isActive) {
        return null;
      }

      // Update session activity
      session.lastActivity = new Date();

      return { user, session };
    } catch (error) {
      logger.debug('Token validation failed:', error.message);
      return null;
    }
  }

  /**
   * Enhanced permission checking with context and conditions
   */
  public hasPermission(
    user: User, 
    resource: string, 
    action: Permission['action'],
    context?: Record<string, any>
  ): boolean {
    // Check if user is active
    if (!user.isActive) {
      return false;
    }

    // Super admin bypass (with audit logging)
    const isSuperAdmin = user.roles.some(role => role.name === 'healthcare_admin');
    if (isSuperAdmin && action === 'admin') {
      this.logSecurityEvent('admin_access', { 
        userId: user.id, 
        resource, 
        action, 
        context: context || {} 
      });
      return true;
    }

    // Check role-based permissions
    for (const role of user.roles) {
      if (!role.isHealthcareRole && resource.includes('patient') || resource.includes('phi')) {
        // Non-healthcare roles cannot access PHI
        continue;
      }

      for (const permission of role.permissions) {
        if (this.matchesPermission(permission, resource, action)) {
          // Check conditions if they exist
          if (permission.conditions && context) {
            if (!this.evaluateConditions(permission.conditions, context)) {
              continue;
            }
          }
          
          // Log permission grant for audit
          this.logSecurityEvent('permission_granted', {
            userId: user.id,
            resource,
            action,
            roleName: role.name,
            permissionId: permission.id,
            context: context || {}
          });
          
          return true;
        }
      }
    }

    // Log permission denial for audit
    this.logSecurityEvent('permission_denied', {
      userId: user.id,
      resource,
      action,
      userRoles: user.roles.map(r => r.name),
      context: context || {}
    });

    return false;
  }

  /**
   * Logout user and invalidate session
   */
  public async logout(sessionId: string): Promise<void> {
    this.ensureInitialized();

    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      
      // Remove refresh tokens for this session
      for (const [refreshToken, userId] of this.refreshTokens) {
        if (userId === session.userId) {
          this.refreshTokens.delete(refreshToken);
        }
      }

      await this.logSecurityEvent('user_logout', { 
        userId: session.userId, 
        sessionId 
      });
    }
  }

  /**
   * Create new user (admin function)
   */
  public async createUser(
    userData: Omit<User, 'id' | 'passwordHash' | 'createdAt' | 'lastLogin'>,
    password: string
  ): Promise<User> {
    this.ensureInitialized();

    if (password.length < this.config.passwordMinLength) {
      throw new Error(`Password must be at least ${this.config.passwordMinLength} characters`);
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    const user: User = {
      ...userData,
      id: userId,
      passwordHash,
      createdAt: new Date(),
      isActive: true
    };

    this.users.set(userId, user);

    await this.logSecurityEvent('user_created', { userId, username: user.username });

    return user;
  }

  /**
   * Get active sessions for a user
   */
  public getActiveSessions(userId: string): Session[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId && session.isActive);
  }

  /**
   * Clean up expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    this.ensureInitialized();

    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      
      if (timeSinceActivity > this.config.sessionTimeoutMs) {
        session.isActive = false;
        cleanedCount++;
        
        await this.logSecurityEvent('session_expired', { 
          userId: session.userId, 
          sessionId 
        });
      }
    }

    // Clean up expired refresh tokens
    const expiredRefreshTokens: string[] = [];
    for (const [refreshToken] of this.refreshTokens) {
      try {
        jwt.verify(refreshToken, this.config.jwtSecret);
      } catch {
        expiredRefreshTokens.push(refreshToken);
      }
    }

    for (const token of expiredRefreshTokens) {
      this.refreshTokens.delete(token);
    }

    logger.info(`Cleaned up ${cleanedCount} expired sessions and ${expiredRefreshTokens.length} refresh tokens`);
    return cleanedCount;
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AuthenticationManager not initialized. Call initialize() first.');
    }
  }

  private findUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values())
      .find(user => user.username === username || user.email === username);
  }

  /**
   * Verify MFA token using TOTP
   */
  private verifyMFAToken(secret: string, token: string): boolean {
    // In a real implementation, this would use a TOTP library like 'speakeasy'
    // For now, we'll simulate MFA verification
    const expectedToken = this.generateTOTP(secret);
    return token === expectedToken;
  }

  /**
   * Generate TOTP token (simplified implementation)
   */
  private generateTOTP(secret: string): string {
    // This is a simplified implementation
    // In production, use a proper TOTP library
    const timeStep = Math.floor(Date.now() / 30000);
    const hash = crypto.createHmac('sha1', secret).update(timeStep.toString()).digest();
    const offset = hash[hash.length - 1] & 0xf;
    const code = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
    return (code % 1000000).toString().padStart(6, '0');
  }

  /**
   * Manage concurrent sessions for a user
   */
  private async manageConcurrentSessions(
    userId: string, 
    deviceInfo: { deviceId: string; ipAddress: string; userAgent: string }
  ): Promise<void> {
    const activeSessions = this.getActiveSessions(userId);
    
    if (activeSessions.length >= this.config.maxConcurrentSessions) {
      // Sort by last activity and deactivate oldest sessions
      const sessionsToDeactivate = activeSessions
        .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())
        .slice(0, activeSessions.length - this.config.maxConcurrentSessions + 1);
      
      for (const session of sessionsToDeactivate) {
        session.isActive = false;
        
        // Remove associated refresh tokens
        for (const [refreshToken, tokenUserId] of this.refreshTokens) {
          if (tokenUserId === userId) {
            this.refreshTokens.delete(refreshToken);
          }
        }
        
        await this.logSecurityEvent('session_terminated', { 
          userId, 
          sessionId: session.sessionId,
          reason: 'concurrent_limit_exceeded',
          deviceId: session.deviceId
        });
      }
    }
  }

  /**
   * Update user security metrics
   */
  private async updateUserSecurityMetrics(userId: string, event: string): Promise<void> {
    // In a real implementation, this would update security metrics
    // such as login frequency, risk scores, etc.
    logger.debug(`Updated security metrics for user ${userId}: ${event}`);
  }

  /**
   * Check if permission matches resource and action with wildcards
   */
  private matchesPermission(permission: Permission, resource: string, action: Permission['action']): boolean {
    // Exact match
    if (permission.resource === resource && permission.action === action) {
      return true;
    }
    
    // Wildcard resource matching
    if (permission.resource.endsWith('*')) {
      const baseResource = permission.resource.slice(0, -1);
      if (resource.startsWith(baseResource) && permission.action === action) {
        return true;
      }
    }
    
    // Admin action grants all actions on the resource
    if (permission.resource === resource && permission.action === 'admin') {
      return true;
    }
    
    return false;
  }

  private async createSession(
    user: User, 
    deviceInfo: { deviceId: string; ipAddress: string; userAgent: string }
  ): Promise<Session> {
    // Check concurrent session limit
    const activeSessions = this.getActiveSessions(user.id);
    if (activeSessions.length >= this.config.maxConcurrentSessions) {
      // Deactivate oldest session
      const oldestSession = activeSessions
        .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())[0];
      oldestSession.isActive = false;
      
      await this.logSecurityEvent('session_limit_exceeded', { 
        userId: user.id, 
        deactivatedSession: oldestSession.sessionId 
      });
    }

    const sessionId = crypto.randomUUID();
    const now = new Date();

    // Collect all permissions from user roles
    const permissions: Permission[] = [];
    for (const role of user.roles) {
      permissions.push(...role.permissions);
    }

    const session: Session = {
      sessionId,
      userId: user.id,
      deviceId: deviceInfo.deviceId,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      createdAt: now,
      lastActivity: now,
      isActive: true,
      permissions
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  private async generateTokens(user: User, session: Session): Promise<AuthToken> {
    const now = new Date();
    const accessTokenExpiry = new Date(now.getTime() + this.config.accessTokenExpiryMs);
    const refreshTokenExpiry = new Date(now.getTime() + this.config.refreshTokenExpiryMs);

    // Create access token payload
    const accessTokenPayload = {
      userId: user.id,
      sessionId: session.sessionId,
      username: user.username,
      roles: user.roles.map(r => r.name),
      permissions: session.permissions.map(p => `${p.resource}:${p.action}`),
      type: 'access'
    };

    // Create refresh token payload
    const refreshTokenPayload = {
      userId: user.id,
      sessionId: session.sessionId,
      type: 'refresh'
    };

    const accessToken = jwt.sign(accessTokenPayload, this.config.jwtSecret, {
      expiresIn: Math.floor(this.config.accessTokenExpiryMs / 1000)
    });

    const refreshToken = jwt.sign(refreshTokenPayload, this.config.jwtSecret, {
      expiresIn: Math.floor(this.config.refreshTokenExpiryMs / 1000)
    });

    // Store refresh token
    this.refreshTokens.set(refreshToken, user.id);

    return {
      accessToken,
      refreshToken,
      expiresAt: accessTokenExpiry,
      tokenType: 'Bearer',
      scope: session.permissions.map(p => `${p.resource}:${p.action}`)
    };
  }

  private evaluateConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    // Simple condition evaluation - can be extended for complex rules
    for (const [key, expectedValue] of Object.entries(conditions)) {
      if (context[key] !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  private async loadDefaultRoles(): Promise<void> {
    // Healthcare-specific roles
    const roles: Role[] = [
      {
        id: 'healthcare_admin',
        name: 'Healthcare Administrator',
        description: 'Full administrative access to healthcare data and operations',
        isHealthcareRole: true,
        permissions: [
          { id: 'roster_admin', resource: 'roster_data', action: 'admin' },
          { id: 'user_admin', resource: 'users', action: 'admin' },
          { id: 'system_admin', resource: 'system', action: 'admin' }
        ]
      },
      {
        id: 'operations_analyst',
        name: 'Operations Analyst',
        description: 'Analyze roster operations and generate reports',
        isHealthcareRole: true,
        permissions: [
          { id: 'roster_read', resource: 'roster_data', action: 'read' },
          { id: 'analytics_execute', resource: 'analytics', action: 'execute' },
          { id: 'reports_write', resource: 'reports', action: 'write' }
        ]
      },
      {
        id: 'compliance_officer',
        name: 'Compliance Officer',
        description: 'Monitor compliance and audit trails',
        isHealthcareRole: true,
        permissions: [
          { id: 'audit_read', resource: 'audit_logs', action: 'read' },
          { id: 'compliance_read', resource: 'compliance_data', action: 'read' },
          { id: 'reports_read', resource: 'reports', action: 'read' }
        ]
      },
      {
        id: 'data_viewer',
        name: 'Data Viewer',
        description: 'Read-only access to roster data',
        isHealthcareRole: true,
        permissions: [
          { id: 'roster_read_limited', resource: 'roster_data', action: 'read', 
            conditions: { anonymized: true } }
        ]
      }
    ];

    for (const role of roles) {
      this.roles.set(role.id, role);
    }

    logger.info(`Loaded ${roles.length} default roles`);
  }

  private async loadUsers(): Promise<void> {
    // In a real implementation, this would load from encrypted storage
    // For now, create a default admin user if none exist
    if (this.users.size === 0) {
      const adminRole = this.roles.get('healthcare_admin');
      if (adminRole) {
        await this.createUser({
          username: 'admin',
          email: 'admin@rosteriq.com',
          roles: [adminRole],
          isActive: true,
          mfaEnabled: false
        }, 'admin123456789'); // This should be changed in production
        
        logger.info('Created default admin user');
      }
    }
  }

  private async logSecurityEvent(event: string, details: Record<string, any>): Promise<void> {
    const logEntry = {
      timestamp: new Date(),
      event,
      details: this.securityManager.anonymizePII(details),
      source: 'AuthenticationManager'
    };

    logger.info('Security event:', logEntry);
    
    // In a real implementation, this would also write to a secure audit log
  }

  public shutdown(): void {
    // Clear sensitive data from memory
    this.users.clear();
    this.sessions.clear();
    this.refreshTokens.clear();
    
    logger.info('AuthenticationManager shutdown complete');
  }
}