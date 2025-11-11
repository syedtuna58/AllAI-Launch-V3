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

export async function createVerificationToken(email: string, type: 'email' | 'sms', userId: string | null): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(verificationTokens).values({
    userId,
    email,
    type,
    tokenHash,
    status: 'pending',
    expiresAt,
  });

  return token;
}

interface TenantInviteParams {
  to: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  tenantId: string;
}

export async function sendTenantInvite({
  to,
  tenantName,
  propertyName,
  unitNumber,
  tenantId,
}: TenantInviteParams): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await createVerificationToken(to, 'email', null);
    const inviteLink = `${BASE_URL}/auth/verify-tenant?token=${token}&tenantId=${tenantId}`;

    const emailSent = await sendEmail({
      to,
      subject: `Welcome to ${propertyName} - Set Up Your Tenant Account`,
      html: `
        <h2>Welcome to ${propertyName}!</h2>
        <p>Hi ${tenantName},</p>
        <p>You've been invited to set up your tenant portal account for ${unitNumber} at ${propertyName}.</p>
        <p>With your tenant portal, you can:</p>
        <ul>
          <li>Submit maintenance requests</li>
          <li>View your unit details</li>
          <li>Approve appointment times</li>
          <li>Communicate with property management</li>
        </ul>
        <p><strong><a href="${inviteLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Activate Your Account</a></strong></p>
        <p>Or copy and paste this link:</p>
        <p>${inviteLink}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you have any questions, please contact your property manager.</p>
      `,
    });

    return { success: emailSent };
  } catch (error) {
    console.error('Error sending tenant invite:', error);
    return { success: false, error: 'Failed to send invite email' };
  }
}
