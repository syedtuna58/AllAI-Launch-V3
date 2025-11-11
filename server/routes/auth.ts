import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { users, contractorProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sendMagicLink, verifyEmailToken, sendTenantInvite } from '../services/emailService';
import { sendVerificationCode, verifySMSCode, optOutSMS } from '../services/smsService';
import { createSession, validateSession, revokeSession, revokeAllUserSessions } from '../services/sessionService';

const router = Router();

// Request magic link for email-based login (landlords, platform admins)
router.post('/magic-link', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
    });
    
    const { email } = schema.parse(req.body);
    
    const result = await sendMagicLink(email);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Magic link sent to your email',
        devMagicLink: result.devMagicLink  // Only present in dev mode when email fails
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Verify email token from magic link
router.get('/verify-email', async (req, res) => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token required' });
    }
    
    const result = await verifyEmailToken(token);
    
    if (!result.success || !result.userId) {
      return res.status(400).json({ success: false, error: result.error });
    }
    
    // Get user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, result.userId),
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Create session with remember me
    const session = await createSession({
      userId: user.id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      rememberMe: true,
    });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.primaryRole,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin,
      },
      session: {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// Contractor signup - Step 1: Email verification
router.post('/signup-contractor/email', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
    });
    
    const { email, firstName, lastName } = schema.parse(req.body);
    
    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (!user) {
      // Create new contractor user
      const [newUser] = await db.insert(users).values({
        email,
        firstName,
        lastName,
        primaryRole: 'contractor',
        emailVerified: false,
        phoneVerified: false,
      }).returning();
      user = newUser;
    }
    
    // Send magic link
    const result = await sendMagicLink(email);
    
    res.json({ 
      success: true, 
      userId: user.id,
      message: 'Verification email sent' 
    });
  } catch (error) {
    console.error('Contractor email signup error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Contractor signup - Step 2: Phone verification
router.post('/signup-contractor/phone', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      phone: z.string().min(10),
    });
    
    const { userId, phone } = schema.parse(req.body);
    
    // Update user with phone
    await db.update(users)
      .set({ phone })
      .where(eq(users.id, userId));
    
    // Send SMS verification code
    const result = await sendVerificationCode(phone, userId);
    
    res.json({ 
      success: true, 
      message: 'Verification code sent to your phone' 
    });
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Contractor signup - Step 3: Verify SMS code
router.post('/signup-contractor/verify-phone', async (req, res) => {
  try {
    const schema = z.object({
      phone: z.string(),
      code: z.string().length(6),
    });
    
    const { phone, code } = schema.parse(req.body);
    
    const result = await verifySMSCode(phone, code);
    
    if (!result.success || !result.userId) {
      return res.status(400).json({ success: false, error: result.error });
    }
    
    res.json({ 
      success: true, 
      userId: result.userId,
      message: 'Phone verified successfully' 
    });
  } catch (error) {
    console.error('SMS code verification error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Contractor signup - Step 4: Complete profile with specialties
router.post('/signup-contractor/complete', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      specialtyIds: z.array(z.string()).min(1),
      bio: z.string().optional(),
    });
    
    const { userId, specialtyIds, bio } = schema.parse(req.body);
    
    // Create contractor profile
    await db.insert(contractorProfiles).values({
      userId,
      bio: bio || null,
    });
    
    // Add specialties - Need to create junction table entries
    // This will be handled in storage layer
    
    // Create session
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const session = await createSession({
      userId: user.id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      rememberMe: true,
    });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: 'contractor',
      },
      session: {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      },
    });
  } catch (error) {
    console.error('Contractor profile completion error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Validate current session
router.get('/session', async (req, res) => {
  try {
    const refreshToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'No session token' });
    }
    
    const result = await validateSession(refreshToken);
    
    if (!result.valid || !result.userId) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, result.userId),
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.primaryRole,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin,
      },
    });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ success: false, error: 'Session validation failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const schema = z.object({
      sessionId: z.string(),
    });
    
    const { sessionId } = schema.parse(req.body);
    
    await revokeSession(sessionId);
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Logout all sessions
router.post('/logout-all', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
    });
    
    const { userId } = schema.parse(req.body);
    
    await revokeAllUserSessions(userId);
    
    res.json({ success: true, message: 'All sessions logged out' });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// SMS opt-out
router.post('/sms-opt-out', async (req, res) => {
  try {
    const schema = z.object({
      phone: z.string(),
      userId: z.string().optional(),
      reason: z.string().optional(),
    });
    
    const { phone, userId, reason } = schema.parse(req.body);
    
    await optOutSMS(phone, userId, reason);
    
    res.json({ 
      success: true, 
      message: 'You have been opted out of SMS notifications (except emergencies)' 
    });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

export default router;
