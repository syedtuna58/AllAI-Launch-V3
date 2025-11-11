import { Router } from 'express';
import { requireAuth, requirePlatformAdmin, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { users, organizations, properties, contractorProfiles } from '@shared/schema';
import { eq, count, sql } from 'drizzle-orm';

const router = Router();

// Get system-wide statistics
router.get('/stats', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const [orgCount] = await db.select({ count: count() }).from(organizations);
    const [userCount] = await db.select({ count: count() }).from(users);
    const [contractorCount] = await db.select({ count: count() })
      .from(contractorProfiles);
    const [propertyCount] = await db.select({ count: count() }).from(properties);

    res.json({
      orgCount: orgCount.count,
      userCount: userCount.count,
      contractorCount: contractorCount.count,
      propertyCount: propertyCount.count,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get all organizations
router.get('/organizations', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const orgs = await db.query.organizations.findMany({
      with: {
        members: true,
        properties: true,
      },
      orderBy: (orgs, { desc }) => [desc(orgs.createdAt)],
    });

    const orgsWithCounts = orgs.map(org => ({
      ...org,
      _count: {
        members: org.members?.length || 0,
        properties: org.properties?.length || 0,
      },
    }));

    res.json(orgsWithCounts);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Get all users
router.get('/users', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const allUsers = await db.query.users.findMany({
      orderBy: (users, { desc }) => [desc(users.createdAt)],
      limit: 50,
    });

    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
