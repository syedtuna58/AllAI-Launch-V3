import { Router } from 'express';
import { requireAuth, requirePlatformAdmin, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { users, organizations, properties, contractorProfiles, smartCases, tenants, tenantGroups } from '@shared/schema';
import { eq, count, sql, and, ne } from 'drizzle-orm';

const router = Router();

// Get system-wide statistics
router.get('/stats', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const [orgCount] = await db.select({ count: count() }).from(organizations);
    const [userCount] = await db.select({ count: count() }).from(users);
    const [contractorCount] = await db.select({ count: count() })
      .from(contractorProfiles);
    const [propertyCount] = await db.select({ count: count() }).from(properties);
    const [openCaseCount] = await db.select({ count: count() })
      .from(smartCases)
      .where(and(
        ne(smartCases.status, 'Completed'),
        ne(smartCases.status, 'Cancelled')
      ));

    res.json({
      orgCount: orgCount.count,
      userCount: userCount.count,
      contractorCount: contractorCount.count,
      propertyCount: propertyCount.count,
      openCaseCount: openCaseCount.count,
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

    // Get owner info, case counts, and tenant counts for each org
    const orgsWithDetails = await Promise.all(orgs.map(async (org) => {
      const owner = await db.query.users.findFirst({
        where: eq(users.id, org.ownerId),
      });
      
      const [caseCount] = await db.select({ count: count() })
        .from(smartCases)
        .where(eq(smartCases.orgId, org.id));
      
      const [tenantCount] = await db.select({ count: count() })
        .from(tenants)
        .innerJoin(tenantGroups, eq(tenants.groupId, tenantGroups.id))
        .where(eq(tenantGroups.orgId, org.id));

      return {
        ...org,
        ownerName: owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email : 'Unknown',
        ownerEmail: owner?.email,
        _count: {
          members: org.members?.length || 0,
          properties: org.properties?.length || 0,
          cases: caseCount.count,
          tenants: tenantCount.count,
        },
      };
    }));

    res.json(orgsWithDetails);
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
