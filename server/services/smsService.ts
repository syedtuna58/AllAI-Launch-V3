import crypto from 'crypto';
import { db } from '../db';
import { verificationTokens, users, smsOptOuts } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { getTwilioClient, getTwilioFromPhoneNumber } from './twilioClient';

interface SendSMSParams {
  to: string;
  message: string;
  isEmergency?: boolean;
}

async function sendSMS({ to, message, isEmergency = false }: SendSMSParams): Promise<boolean> {
  // Check opt-out unless it's an emergency
  if (!isEmergency) {
    const optOut = await db.query.smsOptOuts.findFirst({
      where: eq(smsOptOuts.phone, to),
    });
    
    if (optOut) {
      console.log(`User ${to} has opted out of SMS. Skipping non-emergency message.`);
      return false;
    }
  }

  try {
    const client = await getTwilioClient();
    const fromPhoneNumber = await getTwilioFromPhoneNumber();
    
    await client.messages.create({
      body: message,
      from: fromPhoneNumber,
      to,
    });
    
    console.log(`✅ SMS sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    console.warn('⚠️ SMS sending failed. Message would be sent to:', to);
    console.log('Message:', message);
    return false;
  }
}

export async function sendVerificationCode(phone: string, userId?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create verification token
    await db.insert(verificationTokens).values({
      userId: userId || null,
      phone,
      type: 'sms',
      tokenHash,
      status: 'pending',
      expiresAt,
    });

    const message = `Your Property Management verification code is: ${code}. Valid for 10 minutes.`;
    
    await sendSMS({ to: phone, message });

    return { success: true };
  } catch (error) {
    console.error('Error sending verification code:', error);
    return { success: false, error: 'Failed to send verification code' };
  }
}

export async function verifySMSCode(phone: string, code: string): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
    
    // Find valid token
    const verificationToken = await db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.phone, phone),
        eq(verificationTokens.tokenHash, tokenHash),
        eq(verificationTokens.type, 'sms'),
        eq(verificationTokens.status, 'pending'),
        gt(verificationTokens.expiresAt, new Date())
      ),
    });

    if (!verificationToken) {
      return { success: false, error: 'Invalid or expired code' };
    }

    // Mark token as verified
    await db.update(verificationTokens)
      .set({ status: 'verified', verifiedAt: new Date() })
      .where(eq(verificationTokens.id, verificationToken.id));

    // Mark user phone as verified if userId exists
    if (verificationToken.userId) {
      await db.update(users)
        .set({ phoneVerified: true })
        .where(eq(users.id, verificationToken.userId));
    }

    return { success: true, userId: verificationToken.userId || undefined };
  } catch (error) {
    console.error('Error verifying SMS code:', error);
    return { success: false, error: 'Failed to verify code' };
  }
}

export async function sendEmergencyNotification(phone: string, message: string): Promise<boolean> {
  return await sendSMS({ 
    to: phone, 
    message: `🚨 EMERGENCY: ${message}`,
    isEmergency: true 
  });
}

export async function optOutSMS(phone: string, userId?: string, reason?: string): Promise<boolean> {
  try {
    await db.insert(smsOptOuts).values({
      phone,
      userId: userId || null,
      reason: reason || null,
    }).onConflictDoNothing();
    
    return true;
  } catch (error) {
    console.error('Error opting out of SMS:', error);
    return false;
  }
}
