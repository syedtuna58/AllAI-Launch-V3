import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { properties, smartCases, tenants } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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

export default router;
