import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { tenants, smartCases, caseMedia } from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

const createCaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.string().optional(),
  category: z.string().optional(),
  aiTriageJson: z.any().optional(),
  mediaUrls: z.array(z.string()).optional(),
});

// Get tenant info with unit and property
router.get('/info', requireAuth, requireRole('tenant'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userOrgId = req.user!.orgId;
    
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
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Validate that the property belongs to the user's organization
    if (tenant.unit.property.orgId !== userOrgId) {
      console.error(`Tenant ${tenant.id} unit/property orgId mismatch: ${tenant.unit.property.orgId} !== ${userOrgId}`);
      return res.status(403).json({ error: 'Organization mismatch' });
    }

    res.json({
      id: tenant.id,
      unitId: tenant.unitId,
      unit: tenant.unit,
    });
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    res.status(500).json({ error: 'Failed to fetch tenant info' });
  }
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
    const userOrgId = req.user!.orgId;
    
    // Get tenant record to access unitId for legacy cases
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get cases: either new cases (reporterUserId) or legacy cases (unitId)
    const whereClauses = tenant.unitId 
      ? or(
          eq(smartCases.reporterUserId, userId),
          eq(smartCases.unitId, tenant.unitId)
        )
      : eq(smartCases.reporterUserId, userId);

    const cases = await db.query.smartCases.findMany({
      where: whereClauses,
      with: {
        property: true,
        unit: true,
        media: true,
      },
      orderBy: (cases, { desc }) => [desc(cases.createdAt)],
    });

    // Filter cases to ensure they belong to the user's organization
    const scopedCases = cases.filter(c => {
      const caseOrgId = c.property?.orgId || c.orgId;
      if (caseOrgId !== userOrgId) {
        console.warn(`Filtering out case ${c.id} with orgId ${caseOrgId} (expected ${userOrgId})`);
        return false;
      }
      return true;
    });

    res.json(scopedCases);
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

    // Get tenant record with full property chain
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

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (!tenant.unit) {
      return res.status(400).json({ error: 'No unit assigned' });
    }

    // Derive orgId from property chain (preferred) or direct tenant.orgId (legacy)
    const derivedOrgId = tenant.unit.property.orgId || tenant.orgId;
    
    if (!derivedOrgId) {
      console.error(`Tenant ${tenant.id} cannot create case - no orgId`);
      return res.status(403).json({ error: 'Organization not found for tenant' });
    }

    // Validate derived orgId matches authenticated user's orgId
    if (derivedOrgId !== req.user!.orgId) {
      console.error(`Tenant ${tenant.id} orgId mismatch: derived ${derivedOrgId} !== auth ${req.user!.orgId}`);
      return res.status(403).json({ error: 'Organization mismatch' });
    }

    // Map AI triage urgency to database priority enum
    const mapUrgencyToPriority = (urgency: string): 'Normal' | 'High' | 'Urgent' => {
      const urgencyLower = urgency.toLowerCase();
      if (urgencyLower === 'critical' || urgencyLower === 'urgent') return 'Urgent';
      if (urgencyLower === 'high') return 'High';
      return 'Normal'; // Default for 'low', 'medium', or any other value
    };

    // Create the case
    const [newCase] = await db.insert(smartCases).values({
      title: parsed.data.title,
      description: parsed.data.description,
      orgId: derivedOrgId,
      propertyId: tenant.unit.propertyId,
      unitId: tenant.unitId,
      reporterUserId: userId,
      status: 'New',
      priority: mapUrgencyToPriority(parsed.data.priority || 'Normal'),
      category: parsed.data.category,
      aiTriageJson: parsed.data.aiTriageJson,
    }).returning();

    // Handle media uploads if provided
    if (parsed.data.mediaUrls && parsed.data.mediaUrls.length > 0) {
      await db.insert(caseMedia).values(
        parsed.data.mediaUrls.map(url => ({
          caseId: newCase.id,
          url,
          type: 'image',
        }))
      );
    }

    res.json(newCase);
  } catch (error) {
    console.error('Error creating tenant case:', error);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

export default router;
