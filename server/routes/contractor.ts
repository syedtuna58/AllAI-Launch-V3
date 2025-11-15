import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { getMarketplaceCases, acceptCase } from '../services/contractorMarketplace';
import { db } from '../db';
import { smartCases, contractorOrgLinks, organizationMembers, users, properties, contractorCustomers, insertContractorCustomerSchema, vendors, quotes, quoteLineItems, insertQuoteSchema, insertQuoteLineItemSchema } from '@shared/schema';
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

// ============================================================================
// QUOTE ROUTES
// ============================================================================

// Get all quotes for contractor
router.get('/quotes', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    
    // Use storage to fetch quotes
    const contractorQuotes = await storage.getContractorQuotes(contractorUserId);
    
    res.json(contractorQuotes);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Get single quote with line items
router.get('/quotes/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    
    // Use storage to fetch quote with line items
    const quoteData = await storage.getQuoteWithLineItems(id);
    
    if (!quoteData || quoteData.quote.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    res.json(quoteData);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// Create new quote
router.post('/quotes', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { lineItems, ...quoteData } = req.body;
    
    // Validate customer ownership
    if (quoteData.customerId) {
      const customer = await db.query.contractorCustomers.findFirst({
        where: and(
          eq(contractorCustomers.id, quoteData.customerId),
          eq(contractorCustomers.contractorId, contractorUserId)
        ),
      });
      
      if (!customer) {
        return res.status(403).json({ error: 'Customer not found or access denied' });
      }
    }
    
    // Validate quote data
    const validatedQuoteData = insertQuoteSchema.parse({
      ...quoteData,
      contractorId: contractorUserId,
    });
    
    // Create quote using storage
    const newQuote = await storage.createQuote(validatedQuoteData);
    
    // Create line items if provided
    if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
      for (const item of lineItems) {
        const validatedLineItem = insertQuoteLineItemSchema.parse({
          ...item,
          quoteId: newQuote.id,
          displayOrder: item.displayOrder ?? lineItems.indexOf(item),
        });
        await storage.createQuoteLineItem(validatedLineItem);
      }
    }
    
    // Fetch the complete quote using storage
    const completeQuote = await storage.getQuoteWithLineItems(newQuote.id);
    
    res.json(completeQuote);
  } catch (error: any) {
    console.error('Error creating quote:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid quote data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

// Update quote
router.patch('/quotes/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    
    // Verify quote ownership using storage
    const existing = await storage.getQuote(id);
    
    if (!existing || existing.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // If updating customerId, verify new customer ownership
    if (req.body.customerId && req.body.customerId !== existing.customerId) {
      const customer = await db.query.contractorCustomers.findFirst({
        where: and(
          eq(contractorCustomers.id, req.body.customerId),
          eq(contractorCustomers.contractorId, contractorUserId)
        ),
      });
      
      if (!customer) {
        return res.status(403).json({ error: 'Customer not found or access denied' });
      }
    }
    
    const validatedData = insertQuoteSchema.partial().parse(req.body);
    
    // Update using storage
    const updatedQuote = await storage.updateQuote(id, validatedData);
    
    res.json(updatedQuote);
  } catch (error: any) {
    console.error('Error updating quote:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid quote data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

// Delete quote
router.delete('/quotes/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    
    // Verify ownership using storage
    const existing = await storage.getQuote(id);
    
    if (!existing || existing.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Delete using storage (line items will cascade delete)
    await storage.deleteQuote(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

// Add line item to quote
router.post('/quotes/:quoteId/line-items', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { quoteId } = req.params;
    
    // Verify quote ownership using storage
    const quote = await storage.getQuote(quoteId);
    
    if (!quote || quote.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    const validatedData = insertQuoteLineItemSchema.parse({
      ...req.body,
      quoteId,
    });
    
    // Create using storage
    const newLineItem = await storage.createQuoteLineItem(validatedData);
    
    res.json(newLineItem);
  } catch (error: any) {
    console.error('Error adding line item:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid line item data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to add line item' });
  }
});

// Update line item
router.patch('/quotes/:quoteId/line-items/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { quoteId, id } = req.params;
    
    // Verify quote ownership using storage
    const quote = await storage.getQuote(quoteId);
    
    if (!quote || quote.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Verify line item belongs to this quote
    const lineItems = await storage.getQuoteLineItems(quoteId);
    const lineItem = lineItems.find(item => item.id === id);
    
    if (!lineItem) {
      return res.status(404).json({ error: 'Line item not found or does not belong to this quote' });
    }
    
    // Explicitly reject attempts to reassign quoteId
    if ('quoteId' in req.body) {
      return res.status(400).json({ error: 'Cannot reassign line item to different quote' });
    }
    
    const validatedData = insertQuoteLineItemSchema.partial().parse(req.body);
    
    // Update using storage
    const updatedLineItem = await storage.updateQuoteLineItem(id, validatedData);
    
    res.json(updatedLineItem);
  } catch (error: any) {
    console.error('Error updating line item:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid line item data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update line item' });
  }
});

// Delete line item
router.delete('/quotes/:quoteId/line-items/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { quoteId, id } = req.params;
    
    // Verify quote ownership using storage
    const quote = await storage.getQuote(quoteId);
    
    if (!quote || quote.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Verify line item belongs to this quote
    const lineItems = await storage.getQuoteLineItems(quoteId);
    const lineItem = lineItems.find(item => item.id === id);
    
    if (!lineItem) {
      return res.status(404).json({ error: 'Line item not found or does not belong to this quote' });
    }
    
    // Delete using storage
    await storage.deleteQuoteLineItem(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting line item:', error);
    res.status(500).json({ error: 'Failed to delete line item' });
  }
});

export default router;
