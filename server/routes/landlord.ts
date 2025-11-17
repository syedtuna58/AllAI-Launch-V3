import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { properties, smartCases, tenants, ownershipEntities, units, transactions } from '@shared/schema';
import { eq, and, ne, gte, desc, count } from 'drizzle-orm';

const router = Router();

// Get landlord's properties
router.get('/properties', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const props = await db.query.properties.findMany({
      where: eq(properties.orgId, orgId),
      with: {
        units: true,
      },
      orderBy: (props, { desc }) => [desc(props.createdAt)],
    });

    const propsWithCounts = props.map(prop => ({
      ...prop,
      _count: {
        units: prop.units?.length || 0,
      },
    }));

    res.json(propsWithCounts);
  } catch (error) {
    console.error('Error fetching landlord properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get landlord's cases
router.get('/cases', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const cases = await db.query.smartCases.findMany({
      where: eq(smartCases.orgId, orgId),
      with: {
        property: true,
        unit: true,
      },
      orderBy: (cases, { desc }) => [desc(cases.createdAt)],
      limit: 50,
    });

    res.json(cases);
  } catch (error) {
    console.error('Error fetching landlord cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Get landlord's tenants
router.get('/tenants', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const orgTenants = await db.query.tenants.findMany({
      where: eq(tenants.orgId, orgId),
      with: {
        user: true,
        unit: {
          with: {
            property: true,
          },
        },
      },
      orderBy: (tenants, { desc }) => [desc(tenants.createdAt)],
    });

    res.json(orgTenants);
  } catch (error) {
    console.error('Error fetching landlord tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Get landlord's ownership entities
router.get('/entities', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const entities = await db.query.ownershipEntities.findMany({
      where: eq(ownershipEntities.orgId, orgId),
      orderBy: (entities, { asc }) => [asc(entities.name)],
    });

    res.json(entities);
  } catch (error) {
    console.error('Error fetching entities:', error);
    res.status(500).json({ error: 'Failed to fetch entities' });
  }
});

// Get landlord's units  
router.get('/units', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const orgUnits = await db.query.units.findMany({
      where: eq(units.orgId, orgId),
      with: {
        property: true,
      },
      orderBy: [desc(units.createdAt)],
    });

    res.json(orgUnits);
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

// Get dashboard stats
router.get('/dashboard/stats', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Count properties
    const [propertyCount] = await db.select({ count: count() })
      .from(properties)
      .where(eq(properties.orgId, orgId));
    
    // Count open cases
    const [caseCount] = await db.select({ count: count() })
      .from(smartCases)
      .where(and(
        eq(smartCases.orgId, orgId),
        ne(smartCases.status, 'Resolved'),
        ne(smartCases.status, 'Closed')
      ));

    res.json({
      totalProperties: propertyCount.count || 0,
      monthlyRevenue: 0,  // Stub - revenue calculation would need transactions aggregation
      openCases: caseCount.count || 0,
      dueReminders: 0,  // Stub - would need reminders table join
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get rent collection status (stub for now)
router.get('/dashboard/rent-collection', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Stub response - would need proper rent tracking logic
    res.json({
      collected: 0,
      pending: 0,
      overdue: 0,
    });
  } catch (error) {
    console.error('Error fetching rent collection:', error);
    res.status(500).json({ error: 'Failed to fetch rent collection' });
  }
});

// Get predictive insights (stub for now)
router.get('/predictive-insights', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Return empty array - predictive insights disabled
    res.json([]);
  } catch (error) {
    console.error('Error fetching predictive insights:', error);
    res.status(500).json({ error: 'Failed to fetch predictive insights' });
  }
});

export default router;
