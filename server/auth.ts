import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { config } from "./config";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: config.databaseUrl,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: config.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Update user profile endpoint
  app.patch("/api/auth/user/profile", isAuthenticated, async (req, res) => {
    try {
      const { firstName, lastName, email, phone, bio } = req.body;
      
      // Simple validation
      const errors: string[] = [];
      if (!firstName || firstName.length === 0) errors.push("First name is required");
      if (!lastName || lastName.length === 0) errors.push("Last name is required");  
      if (!email || !email.includes("@")) errors.push("Please enter a valid email address");
      
      if (errors.length > 0) {
        return res.status(400).json({ message: "Validation failed", errors });
      }

      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const updatedUser = await storage.upsertUser({
        id: userId,
        firstName,
        lastName,
        email,
        phone: phone || null,
        bio: bio || null,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check session-based auth
  if (req.session?.userId) {
    // Normalize session user to match expected req.user.claims.sub format
    // This ensures downstream route handlers work without modification
    if (!req.user) {
      req.user = { claims: { sub: req.session.userId } } as any;
    }
    return next();
  }

  // No valid session found
  return res.status(401).json({ message: "Unauthorized" });
};

