import { Router } from 'express';
import { db } from '../db';
import { users, tenants, verificationTokens } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { createSession } from '../services/sessionService';

const router = Router();

// Verify tenant invitation token
router.get('/verify-tenant', async (req, res) => {
  try {
    const { token, tenantId } = req.query;

    if (!token || !tenantId) {
      return res.status(400).json({ error: 'Token and tenantId are required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token as string).digest('hex');

    // Find valid token
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

    // Get tenant record
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId as string),
      with: {
        unit: {
          with: {
            property: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // CRITICAL SECURITY CHECK: Verify token email matches tenant email
    // This prevents token replay attacks where someone uses their token for a different tenantId
    if (verificationToken.email !== tenant.email) {
      console.error('Token email mismatch:', {
        tokenEmail: verificationToken.email,
        tenantEmail: tenant.email,
      });
      return res.status(403).json({ error: 'Invalid token for this tenant' });
    }

    // Check if user already exists
    let user = await db.query.users.findFirst({
      where: eq(users.email, tenant.email),
    });

    if (!user) {
      // Create user account for tenant
      const [newUser] = await db.insert(users).values({
        email: tenant.email,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        phone: tenant.phone,
        primaryRole: 'tenant',
        emailVerified: true,
      }).returning();
      user = newUser;

      // Link tenant to user
      await db.update(tenants)
        .set({ userId: user.id })
        .where(eq(tenants.id, tenant.id));
    } else {
      // User exists - update tenant link
      await db.update(tenants)
        .set({ userId: user.id })
        .where(eq(tenants.id, tenant.id));

      // Mark email as verified
      await db.update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, user.id));
    }

    // Mark token as verified
    await db.update(verificationTokens)
      .set({ status: 'verified', verifiedAt: new Date() })
      .where(eq(verificationTokens.id, verificationToken.id));

    // Create session
    const session = await createSession(user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.primaryRole,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin || false,
      },
      session: {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      },
    });
  } catch (error) {
    console.error('Error verifying tenant:', error);
    res.status(500).json({ error: 'Failed to verify tenant' });
  }
});

export default router;
