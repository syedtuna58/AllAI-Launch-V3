import crypto from 'crypto';
import { db } from '../db';
import { userSessions, users } from '@shared/schema';
import { eq, and, gt, lt } from 'drizzle-orm';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

interface CreateSessionParams {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  rememberMe?: boolean;
}

interface SessionData {
  sessionId: string;
  userId: string;
  refreshToken: string;
}

export async function createSession({ 
  userId, 
  userAgent, 
  ipAddress, 
  rememberMe = true 
}: CreateSessionParams): Promise<SessionData> {
  // Generate refresh token
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  // Indefinite session if rememberMe, otherwise null (means session-based)
  const expiresAt = rememberMe ? null : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours if not rememberMe

  const [session] = await db.insert(userSessions).values({
    userId,
    refreshTokenHash,
    expiresAt,
    userAgent: userAgent || null,
    ipAddress: ipAddress || null,
    lastActiveAt: new Date(),
  }).returning();

  return {
    sessionId: session.id,
    userId: session.userId,
    refreshToken,
  };
}

export async function validateSession(refreshToken: string): Promise<{ valid: boolean; userId?: string; sessionId?: string }> {
  try {
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    const session = await db.query.userSessions.findFirst({
      where: and(
        eq(userSessions.refreshTokenHash, refreshTokenHash),
        // Only check expiration if expiresAt is set
      ),
    });

    if (!session) {
      return { valid: false };
    }

    // Check expiration if set
    if (session.expiresAt && session.expiresAt < new Date()) {
      return { valid: false };
    }

    // Update last active
    await db.update(userSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(userSessions.id, session.id));

    return { valid: true, userId: session.userId, sessionId: session.id };
  } catch (error) {
    console.error('Error validating session:', error);
    return { valid: false };
  }
}

export async function revokeSession(sessionId: string): Promise<boolean> {
  try {
    await db.delete(userSessions).where(eq(userSessions.id, sessionId));
    return true;
  } catch (error) {
    console.error('Error revoking session:', error);
    return false;
  }
}

export async function revokeAllUserSessions(userId: string): Promise<boolean> {
  try {
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
    return true;
  } catch (error) {
    console.error('Error revoking all user sessions:', error);
    return false;
  }
}

export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await db.delete(userSessions)
      .where(
        lt(userSessions.expiresAt, new Date()) // Remove sessions where expiresAt < now
      );
    
    return result.rowCount || 0;
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    return 0;
  }
}
