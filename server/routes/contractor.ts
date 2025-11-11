import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { getMarketplaceCases, acceptCase } from '../services/contractorMarketplace';
import { db } from '../db';
import { smartCases } from '@shared/schema';
import { eq } from 'drizzle-orm';

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

export default router;
