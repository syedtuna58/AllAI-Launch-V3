import { Router } from 'express';
import { requireAuth, requirePlatformAdmin, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { users, organizations, properties, contractorProfiles, smartCases, tenants, tenantGroups, userContractorSpecialties, contractorSpecialties, favoriteContractors, scheduledJobs, vendors } from '@shared/schema';
import { eq, count, sql, and, ne, gte, desc, isNull } from 'drizzle-orm';

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
        ne(smartCases.status, 'Resolved'),
        ne(smartCases.status, 'Closed')
      ));

    // Calculate active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [activeUserCount] = await db.select({ count: count() })
      .from(users)
      .where(gte(users.updatedAt, thirtyDaysAgo));

    res.json({
      orgCount: orgCount.count,
      userCount: userCount.count,
      activeUserCount: activeUserCount.count,
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

// Get all users with analytics
router.get('/users', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const allUsers = await db.query.users.findMany({
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });

    // Enrich with analytics data
    const usersWithAnalytics = allUsers.map(user => {
      const lastLogin = user.updatedAt;
      const daysSinceLogin = lastLogin ? Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24)) : null;
      
      // Determine activity status
      let activityStatus = 'inactive';
      if (daysSinceLogin === null) {
        activityStatus = 'never_logged_in';
      } else if (daysSinceLogin <= 7) {
        activityStatus = 'very_active';
      } else if (daysSinceLogin <= 30) {
        activityStatus = 'active';
      } else if (daysSinceLogin <= 90) {
        activityStatus = 'inactive';
      } else {
        activityStatus = 'dormant';
      }

      return {
        ...user,
        lastLoginAt: lastLogin,
        daysSinceLogin,
        activityStatus,
      };
    });

    res.json(usersWithAnalytics);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get contractor marketplace analytics
router.get('/contractors', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Get all contractors with their profiles
    const contractors = await db.select({
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      profileId: contractorProfiles.id,
      bio: contractorProfiles.bio,
      isAvailable: contractorProfiles.isAvailable,
      emergencyAvailable: contractorProfiles.emergencyAvailable,
      maxJobsPerDay: contractorProfiles.maxJobsPerDay,
      responseTimeHours: contractorProfiles.responseTimeHours,
    })
    .from(users)
    .innerJoin(contractorProfiles, eq(users.id, contractorProfiles.userId))
    .where(eq(users.primaryRole, 'contractor'))
    .orderBy(desc(users.createdAt));

    // Enrich with specialties, job stats, and favorites
    const contractorsWithDetails = await Promise.all(contractors.map(async (contractor) => {
      // Get specialties
      const specialties = await db.select({
        name: contractorSpecialties.name,
        tier: contractorSpecialties.tier,
      })
      .from(userContractorSpecialties)
      .innerJoin(contractorSpecialties, eq(userContractorSpecialties.specialtyId, contractorSpecialties.id))
      .where(eq(userContractorSpecialties.userId, contractor.userId));

      // Get job stats
      const [totalJobsResult] = await db.select({ count: count() })
        .from(smartCases)
        .where(eq(smartCases.assignedContractorId, contractor.userId));

      const [completedJobsResult] = await db.select({ count: count() })
        .from(smartCases)
        .where(and(
          eq(smartCases.assignedContractorId, contractor.userId),
          eq(smartCases.status, 'Resolved')
        ));

      const [activeJobsResult] = await db.select({ count: count() })
        .from(smartCases)
        .where(and(
          eq(smartCases.assignedContractorId, contractor.userId),
          ne(smartCases.status, 'Resolved'),
          ne(smartCases.status, 'Closed')
        ));

      // Get favorite count
      const [favoriteCountResult] = await db.select({ count: count() })
        .from(favoriteContractors)
        .where(eq(favoriteContractors.contractorUserId, contractor.userId));

      // Get scheduled jobs count (join through vendors table)
      const [scheduledJobsResult] = await db.select({ count: count() })
        .from(scheduledJobs)
        .innerJoin(vendors, eq(scheduledJobs.contractorId, vendors.id))
        .where(eq(vendors.userId, contractor.userId));

      // Calculate activity status
      const lastLogin = contractor.updatedAt;
      const daysSinceLogin = lastLogin ? Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24)) : null;
      
      let activityStatus = 'inactive';
      if (daysSinceLogin === null) {
        activityStatus = 'never_logged_in';
      } else if (daysSinceLogin <= 7) {
        activityStatus = 'very_active';
      } else if (daysSinceLogin <= 30) {
        activityStatus = 'active';
      } else {
        activityStatus = 'inactive';
      }

      return {
        ...contractor,
        specialties: specialties.map(s => s.name),
        specialtyTiers: specialties.map(s => s.tier),
        totalJobs: totalJobsResult.count,
        completedJobs: completedJobsResult.count,
        activeJobs: activeJobsResult.count,
        scheduledJobs: scheduledJobsResult.count,
        favoriteCount: favoriteCountResult.count,
        daysSinceLogin,
        activityStatus,
        marketplaceActive: contractor.isAvailable && activityStatus !== 'inactive',
      };
    }));

    res.json(contractorsWithDetails);
  } catch (error) {
    console.error('Error fetching contractor analytics:', error);
    res.status(500).json({ error: 'Failed to fetch contractor analytics' });
  }
});

// Superadmin: Impersonate/view as an organization
router.post('/impersonate/:orgId', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId } = req.params;

    // Verify organization exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Store in session
    req.session.viewAsOrgId = orgId;
    req.session.viewAsOrgName = org.name;
    
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve(undefined);
      });
    });

    res.json({
      success: true,
      orgId,
      orgName: org.name,
      message: `Now viewing as organization: ${org.name}`,
    });
  } catch (error) {
    console.error('Error starting org impersonation:', error);
    res.status(500).json({ error: 'Failed to impersonate organization' });
  }
});

// Superadmin: Stop impersonating and return to superadmin view
router.post('/stop-impersonation', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    delete req.session.viewAsOrgId;
    delete req.session.viewAsOrgName;
    
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve(undefined);
      });
    });

    res.json({
      success: true,
      message: 'Returned to superadmin view',
    });
  } catch (error) {
    console.error('Error stopping org impersonation:', error);
    res.status(500).json({ error: 'Failed to stop impersonation' });
  }
});

// Get current impersonation status
router.get('/impersonation-status', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.session.viewAsOrgId) {
      res.json({
        isImpersonating: true,
        orgId: req.session.viewAsOrgId,
        orgName: req.session.viewAsOrgName,
      });
    } else {
      res.json({
        isImpersonating: false,
      });
    }
  } catch (error) {
    console.error('Error getting impersonation status:', error);
    res.status(500).json({ error: 'Failed to get impersonation status' });
  }
});

export default router;
