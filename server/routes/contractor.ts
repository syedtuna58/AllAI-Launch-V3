import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { getMarketplaceCases, acceptCase } from '../services/contractorMarketplace';
import { db } from '../db';
import { smartCases, contractorOrgLinks, organizationMembers, users, properties } from '@shared/schema';
import { eq, and, inArray, or, sql } from 'drizzle-orm';

const router = Router();

// Get marketplace cases for contractor
router.get('/marketplace', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const cases = await getMarketplaceCases(contractorUserId);
    res.json(cases);
  } catch (error) {
    console.error('Error fetching marketplace cases:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace cases' });
  }
});

// Get assigned cases for contractor
router.get('/assigned-cases', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const cases = await db.query.smartCases.findMany({
      where: eq(smartCases.assignedContractorId, contractorUserId),
      with: {
        property: true,
        unit: true,
      },
      orderBy: (cases, { desc }) => [desc(cases.createdAt)],
    });
    res.json(cases);
  } catch (error) {
    console.error('Error fetching assigned cases:', error);
    res.status(500).json({ error: 'Failed to fetch assigned cases' });
  }
});

// Accept a marketplace case
router.post('/accept-case', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { caseId } = req.body;
    
    if (!caseId) {
      return res.status(400).json({ error: 'Case ID is required' });
    }
    
    const result = await acceptCase(contractorUserId, caseId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'Case accepted successfully' });
  } catch (error) {
    console.error('Error accepting case:', error);
    res.status(500).json({ error: 'Failed to accept case' });
  }
});

// Get customers for contractor (org admins + property owners they work with)
router.get('/customers', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    
    // Get all organizations linked to this contractor
    const orgLinks = await db.query.contractorOrgLinks.findMany({
      where: eq(contractorOrgLinks.contractorUserId, contractorUserId),
    });
    
    const orgIds = orgLinks.map(link => link.orgId);
    
    if (orgIds.length === 0) {
      return res.json([]);
    }
    
    // Get org admins from linked organizations
    const orgAdmins = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        companyName: sql<string>`NULL`,
        role: sql<string>`'org_admin'`,
        orgId: organizationMembers.organizationId,
        propertyCount: sql<number>`0`,
        activeJobCount: sql<number>`0`,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(
        and(
          inArray(organizationMembers.organizationId, orgIds),
          eq(organizationMembers.role, 'admin')
        )
      );
    
    // Get property owners from properties in these orgs
    const propertyOwners = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        companyName: sql<string>`NULL`,
        role: sql<string>`'property_owner'`,
        orgId: properties.orgId,
        propertyCount: sql<number>`COUNT(DISTINCT ${properties.id})`.as('property_count'),
        activeJobCount: sql<number>`0`,
      })
      .from(properties)
      .innerJoin(users, eq(properties.ownerId, users.id))
      .where(
        and(
          inArray(properties.orgId, orgIds),
          sql`${properties.ownerId} IS NOT NULL`
        )
      )
      .groupBy(users.id, users.firstName, users.lastName, users.email, properties.orgId);
    
    // Combine and deduplicate customers
    const customersMap = new Map();
    
    [...orgAdmins, ...propertyOwners].forEach(customer => {
      const existing = customersMap.get(customer.id);
      if (!existing) {
        customersMap.set(customer.id, customer);
      } else {
        // If user appears as both admin and owner, prefer admin role
        if (customer.role === 'org_admin') {
          customersMap.set(customer.id, customer);
        }
      }
    });
    
    const customers = Array.from(customersMap.values());
    
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

export default router;
