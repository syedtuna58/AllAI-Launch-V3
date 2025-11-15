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
    
    // Get all organizations linked to this contractor via contractorOrgLinks
    const orgLinks = await db.query.contractorOrgLinks.findMany({
      where: eq(contractorOrgLinks.contractorUserId, contractorUserId),
    });
    
    const linkedOrgIds = orgLinks.map(link => link.orgId);
    
    // Also get organizations from assigned work orders
    const assignedCases = await db
      .select({ orgId: smartCases.orgId })
      .from(smartCases)
      .where(eq(smartCases.assignedContractorId, contractorUserId))
      .groupBy(smartCases.orgId);
    
    const assignedOrgIds = assignedCases.map(c => c.orgId).filter((id): id is string => id !== null);
    
    // Combine and deduplicate org IDs
    const orgIds = [...new Set([...linkedOrgIds, ...assignedOrgIds])];
    
    if (orgIds.length === 0) {
      return res.json([]);
    }
    
    // Get org admins (primary landlords) from linked organizations
    const orgAdminsQuery = await db
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
    
    const orgAdmins = orgAdminsQuery;
    
    // Return org admins as customers (primary landlords)
    res.json(orgAdmins);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

export default router;
