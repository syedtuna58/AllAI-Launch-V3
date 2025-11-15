import { Router } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { contractorCustomers } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Get quote details (public, requires approval token)
router.get('/:id/:token', async (req, res) => {
  try {
    const { id, token } = req.params;
    
    const quoteData = await storage.getQuoteWithLineItems(id);
    
    if (!quoteData) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Validate approval token
    if (!quoteData.quote.approvalToken || quoteData.quote.approvalToken !== token) {
      return res.status(403).json({ error: 'Invalid approval link' });
    }

    // Return only public-safe information (no customer PII)
    res.json({
      id: quoteData.quote.id,
      title: quoteData.quote.title,
      status: quoteData.quote.status,
      subtotal: quoteData.quote.subtotal,
      discountAmount: quoteData.quote.discountAmount,
      taxPercent: quoteData.quote.taxPercent,
      taxAmount: quoteData.quote.taxAmount,
      total: quoteData.quote.total,
      depositType: quoteData.quote.depositType,
      depositValue: quoteData.quote.depositValue,
      requiredDepositAmount: quoteData.quote.requiredDepositAmount,
      clientMessage: quoteData.quote.clientMessage,
      expiresAt: quoteData.quote.expiresAt,
      createdAt: quoteData.quote.createdAt,
      lineItems: quoteData.lineItems,
    });
  } catch (error) {
    console.error('Error fetching public quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// Approve quote (public, requires approval token)
router.post('/:id/:token/approve', async (req, res) => {
  try {
    const { id, token } = req.params;
    
    const quote = await storage.getQuote(id);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Validate approval token
    if (!quote.approvalToken || quote.approvalToken !== token) {
      return res.status(403).json({ error: 'Invalid approval link' });
    }

    // Only allow approval if quote is in 'awaiting_response' status
    if (quote.status !== 'awaiting_response') {
      return res.status(400).json({ error: 'Quote cannot be approved in its current status' });
    }

    // Check if quote has expired
    if (quote.expiresAt && new Date(quote.expiresAt) < new Date()) {
      // Update to expired status
      await storage.updateQuote(id, { status: 'expired' });
      return res.status(400).json({ error: 'Quote has expired' });
    }

    // Update quote status to approved and set approvedAt timestamp
    await storage.updateQuote(id, { 
      status: 'approved',
      approvedAt: new Date(),
    });

    res.json({ success: true, message: 'Quote approved successfully' });
  } catch (error) {
    console.error('Error approving quote:', error);
    res.status(500).json({ error: 'Failed to approve quote' });
  }
});

// Decline quote (public, requires approval token)
router.post('/:id/:token/decline', async (req, res) => {
  try {
    const { id, token } = req.params;
    
    const quote = await storage.getQuote(id);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Validate approval token
    if (!quote.approvalToken || quote.approvalToken !== token) {
      return res.status(403).json({ error: 'Invalid approval link' });
    }

    // Only allow decline if quote is in 'awaiting_response' status
    if (quote.status !== 'awaiting_response') {
      return res.status(400).json({ error: 'Quote cannot be declined in its current status' });
    }

    // Update quote status to declined and set declinedAt timestamp
    await storage.updateQuote(id, { 
      status: 'declined',
      declinedAt: new Date(),
    });

    res.json({ success: true, message: 'Quote declined successfully' });
  } catch (error) {
    console.error('Error declining quote:', error);
    res.status(500).json({ error: 'Failed to decline quote' });
  }
});

export default router;
