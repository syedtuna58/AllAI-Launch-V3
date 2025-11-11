import crypto from 'crypto';
import { db } from '../db';
import { verificationTokens, users } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@propertymanagement.com';
const BASE_URL = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
  : 'http://localhost:5000';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SendGrid not configured. Email would be sent to:', to);
    console.log('Subject:', subject);
    console.log('Body:', html);
    return false;
  }

  try {
    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(SENDGRID_API_KEY);
    
    await sgMail.send({
      to,
      from: SENDGRID_FROM_EMAIL,
      subject,
      html,
    });
    
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Find or create user by email
    let user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      // Create new user if doesn't exist (for contractor signup)
      const [newUser] = await db.insert(users).values({
        email,
        emailVerified: false,
      }).returning();
      user = newUser;
    }

    // Create verification token
    await db.insert(verificationTokens).values({
      userId: user.id,
      email,
      type: 'email',
      tokenHash,
      status: 'pending',
      expiresAt,
    });

    const magicLink = `${BASE_URL}/auth/verify-email?token=${token}`;
    
    const emailSent = await sendEmail({
      to: email,
      subject: 'Your Magic Link to Sign In',
      html: `
        <h2>Sign in to Property Management</h2>
        <p>Click the link below to sign in to your account:</p>
        <p><a href="${magicLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign In</a></p>
        <p>Or copy and paste this link:</p>
        <p>${magicLink}</p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending magic link:', error);
    return { success: false, error: 'Failed to send magic link' };
  }
}

export async function verifyEmailToken(token: string): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
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
      return { success: false, error: 'Invalid or expired token' };
    }

    // Mark token as verified
    await db.update(verificationTokens)
      .set({ status: 'verified', verifiedAt: new Date() })
      .where(eq(verificationTokens.id, verificationToken.id));

    // Mark user email as verified
    if (verificationToken.userId) {
      await db.update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, verificationToken.userId));
    }

    return { success: true, userId: verificationToken.userId || undefined };
  } catch (error) {
    console.error('Error verifying email token:', error);
    return { success: false, error: 'Failed to verify token' };
  }
}

export async function sendTenantInvite(email: string, tenantId: string, propertyName: string): Promise<boolean> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(verificationTokens).values({
    email,
    type: 'email',
    tokenHash,
    status: 'pending',
    expiresAt,
  });

  const inviteLink = `${BASE_URL}/tenant-signup?token=${token}&tenantId=${tenantId}`;
  
  return await sendEmail({
    to: email,
    subject: `You've been invited to access ${propertyName}`,
    html: `
      <h2>Welcome to Property Management</h2>
      <p>You've been invited to access your tenant portal for ${propertyName}.</p>
      <p>Click the link below to set up your account:</p>
      <p><a href="${inviteLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set Up Account</a></p>
      <p>Or copy and paste this link:</p>
      <p>${inviteLink}</p>
      <p>This link will expire in 7 days.</p>
    `,
  });
}
