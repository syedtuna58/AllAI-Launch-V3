import { db } from '../db';
import { 
  smartCases, 
  userContractorSpecialties, 
  favoriteContractors,
  contractorOrgLinks,
  contractorProfiles
} from '@shared/schema';
import { eq, and, or, isNull, inArray, SQL } from 'drizzle-orm';

export interface MarketplaceFilters {
  specialtyIds?: string[];
  orgId?: string;
  isUrgent?: boolean;
  excludeAssigned?: boolean;
}

export async function getMarketplaceCases(contractorUserId: string, filters?: MarketplaceFilters) {
  // Get contractor's specialties
  const contractorSpecialties = await db.query.userContractorSpecialties.findMany({
    where: eq(userContractorSpecialties.userId, contractorUserId),
  });
  
  const userSpecialtyIds = contractorSpecialties.map(cs => cs.specialtyId);
  
  if (userSpecialtyIds.length === 0) {
    return [];
  }
  
  // Build where conditions
  const conditions: SQL<unknown>[] = [
    isNull(smartCases.assignedContractorId), // Only unassigned cases
  ];
  
  // Filter by specialty if specified
  if (filters?.specialtyIds) {
    // This would need a specialty field on smartCases
    // For now, we'll skip this filtering
  }
  
  // Filter by org if specified
  if (filters?.orgId) {
    conditions.push(eq(smartCases.orgId, filters.orgId));
  }
  
  // Filter by urgency if specified
  if (filters?.isUrgent !== undefined) {
    conditions.push(eq(smartCases.isUrgent, filters.isUrgent));
  }
  
  // Get all unassigned cases
  const cases = await db.query.smartCases.findMany({
    where: and(...conditions) as SQL<unknown>,
    with: {
      property: true,
      unit: true,
    },
    orderBy: (cases, { desc }) => [desc(cases.priority), desc(cases.postedAt)],
  });
  
  // Filter cases by access rules
  const visibleCases = [];
  
  for (const caseItem of cases) {
    // Check contractor-org link exists and is active
    if (caseItem.orgId) {
      const link = await db.query.contractorOrgLinks.findFirst({
        where: and(
          eq(contractorOrgLinks.contractorUserId, contractorUserId),
          eq(contractorOrgLinks.orgId, caseItem.orgId),
          eq(contractorOrgLinks.status, 'active')
        ),
      });
      
      // Skip if no active link with this org
      if (!link) {
        continue;
      }
    }
    
    // Check favorite restriction (unless urgent)
    if (caseItem.restrictToFavorites && !caseItem.isUrgent && caseItem.orgId) {
      const isFavorite = await db.query.favoriteContractors.findFirst({
        where: and(
          eq(favoriteContractors.orgId, caseItem.orgId),
          eq(favoriteContractors.contractorUserId, contractorUserId)
        ),
      });
      
      // Skip if not a favorite
      if (!isFavorite) {
        continue;
      }
    }
    
    visibleCases.push(caseItem);
  }
  
  return visibleCases;
}

export async function canContractorAcceptCase(contractorUserId: string, caseId: string): Promise<{ canAccept: boolean; reason?: string }> {
  const caseItem = await db.query.smartCases.findFirst({
    where: eq(smartCases.id, caseId),
  });
  
  if (!caseItem) {
    return { canAccept: false, reason: 'Case not found' };
  }
  
  // Check if already assigned
  if (caseItem.assignedContractorId) {
    return { canAccept: false, reason: 'Case already assigned' };
  }
  
  // Check contractor profile exists and is available
  const profile = await db.query.contractorProfiles.findFirst({
    where: eq(contractorProfiles.userId, contractorUserId),
  });
  
  if (!profile) {
    return { canAccept: false, reason: 'Contractor profile not found' };
  }
  
  if (!profile.isAvailable) {
    return { canAccept: false, reason: 'Contractor is not available' };
  }
  
  // Check contractor-org link
  if (caseItem.orgId) {
    const link = await db.query.contractorOrgLinks.findFirst({
      where: and(
        eq(contractorOrgLinks.contractorUserId, contractorUserId),
        eq(contractorOrgLinks.orgId, caseItem.orgId),
        eq(contractorOrgLinks.status, 'active')
      ),
    });
    
    if (!link) {
      return { canAccept: false, reason: 'No active relationship with this organization' };
    }
  }
  
  // Check favorite restriction (unless urgent)
  if (caseItem.restrictToFavorites && !caseItem.isUrgent && caseItem.orgId) {
    const isFavorite = await db.query.favoriteContractors.findFirst({
      where: and(
        eq(favoriteContractors.orgId, caseItem.orgId),
        eq(favoriteContractors.contractorUserId, contractorUserId)
      ),
    });
    
    if (!isFavorite) {
      return { canAccept: false, reason: 'This job is restricted to favorite contractors only' };
    }
  }
  
  // Check if contractor has matching specialty
  const contractorSpecialties = await db.query.userContractorSpecialties.findMany({
    where: eq(userContractorSpecialties.userId, contractorUserId),
  });
  
  if (contractorSpecialties.length === 0) {
    return { canAccept: false, reason: 'No specialties configured' };
  }
  
  // TODO: Check if case specialty matches contractor's specialties
  // This requires adding specialty field to smartCases
  
  return { canAccept: true };
}

export async function acceptCase(contractorUserId: string, caseId: string): Promise<{ success: boolean; error?: string }> {
  // Verify contractor can accept
  const { canAccept, reason } = await canContractorAcceptCase(contractorUserId, caseId);
  
  if (!canAccept) {
    return { success: false, error: reason };
  }
  
  try {
    // Assign case to contractor
    await db.update(smartCases)
      .set({ 
        assignedContractorId: contractorUserId,
        status: 'in_progress'
      })
      .where(and(
        eq(smartCases.id, caseId),
        isNull(smartCases.assignedContractorId) // Double-check it's still unassigned
      ));
    
    // Create/update contractor-org link
    const caseItem = await db.query.smartCases.findFirst({
      where: eq(smartCases.id, caseId),
    });
    
    if (caseItem?.orgId) {
      const existingLink = await db.query.contractorOrgLinks.findFirst({
        where: and(
          eq(contractorOrgLinks.contractorUserId, contractorUserId),
          eq(contractorOrgLinks.orgId, caseItem.orgId)
        ),
      });
      
      if (existingLink) {
        await db.update(contractorOrgLinks)
          .set({ 
            lastJobAt: new Date(),
            status: 'active'
          })
          .where(eq(contractorOrgLinks.id, existingLink.id));
      } else {
        await db.insert(contractorOrgLinks).values({
          contractorUserId,
          orgId: caseItem.orgId,
          status: 'active',
          lastJobAt: new Date(),
        });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error accepting case:', error);
    return { success: false, error: 'Failed to accept case' };
  }
}
