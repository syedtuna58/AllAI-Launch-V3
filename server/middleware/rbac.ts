import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, organizationMembers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { validateSession } from '../services/sessionService';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    role: 'platform_super_admin' | 'org_admin' | 'contractor' | 'tenant' | null;
    isPlatformSuperAdmin: boolean;
    orgId?: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const refreshToken = authHeader?.replace('Bearer ', '');
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = await validateSession(refreshToken);
    
    if (!session.valid || !session.userId) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    // Get user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Get user's organization membership based on their primary role
    let orgMembership = null;
    
    // For org admins, landlords, and tenants - find membership matching their role
    if (user.primaryRole === 'org_admin') {
      orgMembership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.userId, user.id),
          eq(organizationMembers.membershipStatus, 'active'),
          eq(organizationMembers.orgRole, 'org_admin')
        ),
      });
    } else if (user.primaryRole === 'tenant') {
      // Tenants don't have org memberships - they're linked via tenants table
      // Don't set orgId for tenants
    } else {
      // For platform admins and contractors, they may have org memberships but don't need them
    }
    
    req.userId = user.id;
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.primaryRole,
      isPlatformSuperAdmin: user.isPlatformSuperAdmin || false,
      orgId: orgMembership?.orgId,
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export function requireRole(...allowedRoles: Array<'platform_super_admin' | 'org_admin' | 'contractor' | 'tenant'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Platform super admins can access everything
    if (req.user.isPlatformSuperAdmin) {
      return next();
    }
    
    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

export function requireOrgAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Platform super admins can access all orgs
  if (req.user.isPlatformSuperAdmin) {
    return next();
  }
  
  // Check if user has org membership
  if (!req.user.orgId) {
    return res.status(403).json({ error: 'No organization access' });
  }
  
  next();
}

export function requirePlatformAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!req.user.isPlatformSuperAdmin) {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  
  next();
}

export function requireOwnResource(resourceUserIdGetter: (req: AuthenticatedRequest) => string | undefined) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Platform super admins can access all resources
    if (req.user.isPlatformSuperAdmin) {
      return next();
    }
    
    const resourceUserId = resourceUserIdGetter(req);
    
    if (!resourceUserId || resourceUserId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  };
}
