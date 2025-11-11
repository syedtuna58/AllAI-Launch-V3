import { Router } from 'express';
import { db } from '../db';
import { properties, smartCases, organizationMembers, favoriteContractors, vendors } from '@shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { requireRole } from '../middleware/rbac';
import { z } from 'zod';

const router = Router();

router.use(requireRole(['property_owner']));

router.get('/properties', async (req, res) => {
  try {
    const userId = req.user!.id;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const userProperties = await db.query.properties.findMany({
      where: eq(properties.orgId, membership.orgId),
      with: {
        organization: true,
      },
      orderBy: [desc(properties.createdAt)],
    });

    res.json(userProperties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.post('/properties', async (req, res) => {
  try {
    const userId = req.user!.id;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const propertyData = {
      ...req.body,
      orgId: membership.orgId,
    };

    const [property] = await db.insert(properties).values(propertyData).returning();

    res.json(property);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

router.get('/cases', async (req, res) => {
  try {
    const userId = req.user!.id;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const userProperties = await db.query.properties.findMany({
      where: eq(properties.orgId, membership.orgId),
    });

    const propertyIds = userProperties.map(p => p.id);

    if (propertyIds.length === 0) {
      return res.json([]);
    }

    const cases = await db.query.smartCases.findMany({
      where: or(...propertyIds.map(id => eq(smartCases.propertyId, id))),
      with: {
        property: true,
        assignedContractor: {
          with: {
            user: true,
          },
        },
      },
      orderBy: [desc(smartCases.createdAt)],
    });

    res.json(cases);
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

router.get('/favorites', async (req, res) => {
  try {
    const userId = req.user!.id;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const favorites = await db.query.favoriteContractors.findMany({
      where: eq(favoriteContractors.orgId, membership.orgId),
      with: {
        vendor: {
          with: {
            user: true,
            contractorProfile: {
              with: {
                specialties: {
                  with: {
                    specialty: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/favorites', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { vendorId } = req.body;

    if (!vendorId) {
      return res.status(400).json({ error: 'Vendor ID is required' });
    }

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [favorite] = await db.insert(favoriteContractors).values({
      orgId: membership.orgId,
      vendorId,
      addedBy: userId,
    }).returning();

    res.json(favorite);
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

router.delete('/favorites/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await db.delete(favoriteContractors)
      .where(and(
        eq(favoriteContractors.id, id),
        eq(favoriteContractors.orgId, membership.orgId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

export default router;
