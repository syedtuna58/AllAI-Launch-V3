import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { tenants, smartCases } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

const createCaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

// Get tenant's unit
router.get('/unit', requireAuth, requireRole('tenant'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
      with: {
        unit: {
          with: {
            property: true,
          },
        },
      },
    });

    if (!tenant || !tenant.unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.json(tenant.unit);
  } catch (error) {
    console.error('Error fetching tenant unit:', error);
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
});

// Get tenant's cases
router.get('/cases', requireAuth, requireRole('tenant'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    
    // Get tenant record
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const cases = await db.query.smartCases.findMany({
      where: eq(smartCases.tenantId, tenant.id),
      with: {
        property: true,
        unit: true,
      },
      orderBy: (cases, { desc }) => [desc(cases.createdAt)],
    });

    res.json(cases);
  } catch (error) {
    console.error('Error fetching tenant cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Create a new case
router.post('/cases', requireAuth, requireRole('tenant'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const parsed = createCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // Get tenant record
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
      with: {
        unit: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (!tenant.unit) {
      return res.status(400).json({ error: 'No unit assigned' });
    }

    // Create the case
    const [newCase] = await db.insert(smartCases).values({
      title: parsed.data.title,
      description: parsed.data.description,
      orgId: tenant.orgId,
      propertyId: tenant.unit.propertyId,
      unitId: tenant.unitId,
      tenantId: tenant.id,
      status: 'pending',
      source: 'tenant',
    }).returning();

    res.json(newCase);
  } catch (error) {
    console.error('Error creating tenant case:', error);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

export default router;
