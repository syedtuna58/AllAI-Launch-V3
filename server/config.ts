/**
 * Centralized configuration for all environment variables
 * All environment variable access should go through this file
 * 
 * This file loads environment variables from a .env file in the project root.
 * Create a .env file based on .env.example with your actual values.
 */

// Load environment variables from .env file FIRST (before any other imports)
import dotenv from 'dotenv';
dotenv.config();

interface Config {
  // Server
  nodeEnv: string;
  port: number;
  
  // Database
  databaseUrl: string;
  
  // Session
  sessionSecret: string;
  
  // API Keys
  openaiApiKey: string | undefined;
  sendgridApiKey: string | undefined;
  sendgridFromEmail: string;
  brevoApiKey: string | undefined;
  
  // Twilio
  twilioAccountSid: string | undefined;
  twilioAuthToken: string | undefined;
  twilioPhoneNumber: string | undefined;
  
  // URLs
  baseUrl: string;
  devDomain: string | undefined;
  domains: string[]; // For backward compatibility, can be used for multiple domains
  
  // Object Storage
  privateObjectDir: string;
  
  // Google Calendar (if using direct OAuth instead of Replit connectors)
  googleCalendarClientId: string | undefined;
  googleCalendarClientSecret: string | undefined;
  googleCalendarRedirectUri: string | undefined;
}

function getConfig(): Config {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  return {
    // Server
    nodeEnv,
    port: parseInt(process.env.PORT || '5000', 10),
    
    // Database
    databaseUrl: process.env.DATABASE_URL || '',
    
    // Session
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    
    // API Keys
    openaiApiKey: process.env.OPENAI_API_KEY,
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@propertymanagement.com',
    brevoApiKey: process.env.BREVO_API_KEY,
    
    // Twilio
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    
    // URLs
    baseUrl: process.env.BASE_URL || (nodeEnv === 'development' ? 'http://localhost:5000' : ''),
    devDomain: process.env.DEV_DOMAIN,
    domains: process.env.DOMAINS ? process.env.DOMAINS.split(',') : (process.env.DEV_DOMAIN ? [process.env.DEV_DOMAIN] : ['localhost:5000']),
    
    // Object Storage
    privateObjectDir: process.env.PRIVATE_OBJECT_DIR || '',
    
    // Google Calendar
    googleCalendarClientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    googleCalendarClientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    googleCalendarRedirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
  };
}

export const config = getConfig();

// Validate required config values
if (!config.databaseUrl) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

