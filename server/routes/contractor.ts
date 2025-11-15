import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { getMarketplaceCases, acceptCase } from '../services/contractorMarketplace';
import { db } from '../db';
import { smartCases, contractorOrgLinks, organizationMembers, users, properties, contractorCustomers, insertContractorCustomerSchema, vendors } from '@shared/schema';
import { eq, and, inArray, or, sql } from 'drizzle-orm';
import { storage } from '../storage';

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

// Get all customers for this contractor
router.get('/customers', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    
    const customers = await db.query.contractorCustomers.findMany({
      where: eq(contractorCustomers.contractorId, contractorUserId),
      orderBy: (customers, { desc }) => [desc(customers.createdAt)],
    });
    
    // Get vendor IDs for this contractor (they may work across multiple orgs)
    const contractorVendors = await storage.getContractorVendorsByUserId(contractorUserId);
    const vendorIds = contractorVendors.map(v => v.id);
    
    // Get active job counts for each customer
    const customerIds = customers.map(c => c.id);
    let activeJobCounts: { customerId: string; count: number }[] = [];
    
    if (customerIds.length > 0 && vendorIds.length > 0) {
      activeJobCounts = await db
        .select({
          customerId: smartCases.customerId,
          count: sql<number>`count(*)::int`.as('count'),
        })
        .from(smartCases)
        .where(
          and(
            inArray(smartCases.customerId, customerIds),
            inArray(smartCases.assignedContractorId, vendorIds),
            sql`${smartCases.status} NOT IN ('Closed', 'Resolved')`
          )
        )
        .groupBy(smartCases.customerId);
    }
    
    // Create lookup map for active job counts
    const activeJobCountMap = new Map(activeJobCounts.map(ajc => [ajc.customerId, ajc.count]));
    
    // Add metrics to customers
    const customersWithMetrics = customers.map(customer => ({
      ...customer,
      activeJobCount: activeJobCountMap.get(customer.id) || 0,
    }));
    
    res.json(customersWithMetrics);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Create a new customer
router.post('/customers', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const validatedData = insertContractorCustomerSchema.parse({
      ...req.body,
      contractorId: contractorUserId,
    });
    
    const [newCustomer] = await db
      .insert(contractorCustomers)
      .values(validatedData)
      .returning();
    
    res.json(newCustomer);
  } catch (error: any) {
    console.error('Error creating customer:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid customer data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update a customer
router.patch('/customers/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    
    // Verify the customer belongs to this contractor
    const existing = await db.query.contractorCustomers.findFirst({
      where: and(
        eq(contractorCustomers.id, id),
        eq(contractorCustomers.contractorId, contractorUserId)
      ),
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const validatedData = insertContractorCustomerSchema.partial().parse(req.body);
    
    const [updatedCustomer] = await db
      .update(contractorCustomers)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(contractorCustomers.id, id))
      .returning();
    
    res.json(updatedCustomer);
  } catch (error: any) {
    console.error('Error updating customer:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid customer data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete a customer
router.delete('/customers/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    
    // Verify the customer belongs to this contractor
    const existing = await db.query.contractorCustomers.findFirst({
      where: and(
        eq(contractorCustomers.id, id),
        eq(contractorCustomers.contractorId, contractorUserId)
      ),
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Check if customer has any work orders
    const workOrderCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(smartCases)
      .where(eq(smartCases.customerId, id));
    
    if (workOrderCount[0]?.count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete customer with ${workOrderCount[0].count} existing work order${workOrderCount[0].count > 1 ? 's' : ''}` 
      });
    }
    
    await db
      .delete(contractorCustomers)
      .where(eq(contractorCustomers.id, id));
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    // Check for database foreign key constraint errors
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete customer with existing work orders' });
    }
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;
