import crypto from 'crypto';

/**
 * Generate a secure random approval token
 * @param length - Length of the token (default: 32)
 * @returns A URL-safe base64 token
 */
export function generateApprovalToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}
