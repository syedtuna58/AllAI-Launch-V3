import { Router } from 'express';
import { db } from '../db';
import { users, organizations, organizationMembers, properties } from '@shared/schema';
import { z } from 'zod';
import { sendEmail, createVerificationToken } from '../services/emailService';
import crypto from 'crypto';
import { verificationTokens } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { createSession } from '../services/sessionService';

const router = Router();

const propertyOwnerSignupSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

router.post('/signup-property-owner', async (req, res) => {
  try {
    const validatedData = propertyOwnerSignupSchema.parse(req.body);
    const { email, firstName, lastName, phone } = validatedData;

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const token = await createVerificationToken(email, 'email', null);
    const BASE_URL = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : 'http://localhost:5000';
    const verifyLink = `${BASE_URL}/auth/verify-property-owner?token=${token}`;

    await sendEmail({
      to: email,
      subject: 'Welcome to Property Management - Verify Your Email',
      html: `
        <h2>Welcome ${firstName}!</h2>
        <p>Thank you for joining our property management platform. Click the link below to verify your email and set up your account:</p>
        <p><a href="${verifyLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a></p>
        <p>Or copy and paste this link:</p>
        <p>${verifyLink}</p>
        <p>This link will expire in 24 hours.</p>
      `,
    });

    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Property owner signup error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to process signup' });
  }
});

router.get('/verify-property-owner', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token as string).digest('hex');

    const verificationToken = await db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.tokenHash, tokenHash),
        eq(verificationTokens.type, 'email'),
        eq(verificationTokens.status, 'pending'),
        gt(verificationTokens.expiresAt, new Date())
      ),
    });

    if (!verificationToken) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const [user] = await db.insert(users).values({
      email: verificationToken.email,
      primaryRole: 'property_owner',
      emailVerified: true,
    }).returning();

    const [org] = await db.insert(organizations).values({
      name: `${verificationToken.email}'s Properties`,
      ownerId: user.id,
      ownerType: 'property_owner',
    }).returning();

    await db.insert(organizationMembers).values({
      orgId: org.id,
      userId: user.id,
      orgRole: 'property_owner',
      membershipStatus: 'active',
      joinedAt: new Date(),
    });

    await db.update(verificationTokens)
      .set({ status: 'verified', verifiedAt: new Date() })
      .where(eq(verificationTokens.id, verificationToken.id));

    const session = await createSession(user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.primaryRole,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin || false,
      },
      session: {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      },
    });
  } catch (error) {
    console.error('Property owner verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

export default router;
