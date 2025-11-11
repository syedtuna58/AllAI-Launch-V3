import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { tenants, units, properties } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { sendTenantInvite } from '../services/emailService';

const router = Router();

const inviteTenantSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  unitId: z.string(),
  moveInDate: z.string().optional(),
});

// Invite a tenant
router.post('/invite-tenant', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const parsed = inviteTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request data', details: parsed.error });
    }

    const { email, firstName, lastName, phone, unitId, moveInDate } = parsed.data;

    // Verify unit belongs to this org
    const unit = await db.query.units.findFirst({
      where: eq(units.id, unitId),
      with: {
        property: true,
      },
    });

    if (!unit || unit.property.orgId !== orgId) {
      return res.status(403).json({ error: 'Unit not found or access denied' });
    }

    // Check if tenant already exists for this email and unit
    const existingTenant = await db.query.tenants.findFirst({
      where: and(
        eq(tenants.email, email),
        eq(tenants.unitId, unitId)
      ),
    });

    if (existingTenant) {
      return res.status(400).json({ error: 'Tenant already invited for this unit' });
    }

    // Create tenant record with invited status
    const [newTenant] = await db.insert(tenants).values({
      orgId,
      unitId,
      email,
      firstName,
      lastName,
      phone: phone || null,
      invitedBy: req.user!.id,
      invitedAt: new Date(),
      moveInDate: moveInDate ? new Date(moveInDate) : null,
    }).returning();

    // Send invite email
    const inviteResult = await sendTenantInvite({
      to: email,
      tenantName: `${firstName} ${lastName}`,
      propertyName: unit.property.name || unit.property.street,
      unitNumber: unit.unitNumber || 'your unit',
      tenantId: newTenant.id,
    });

    if (!inviteResult.success) {
      console.error('Failed to send tenant invite email:', inviteResult.error);
      // Don't fail the request - tenant is created, email can be resent
    }

    res.json({
      success: true,
      tenant: newTenant,
      emailSent: inviteResult.success,
    });
  } catch (error) {
    console.error('Error inviting tenant:', error);
    res.status(500).json({ error: 'Failed to invite tenant' });
  }
});

export default router;
