import { SQL, eq, and, or, inArray } from 'drizzle-orm';
import { db } from '../db';
import { 
  smartCases, 
  properties, 
  tenants,
  userContractorSpecialties,
  favoriteContractors,
  contractorOrgLinks
} from '@shared/schema';

export interface UserScope {
  userId: string;
  role: 'platform_super_admin' | 'org_admin' | 'contractor' | 'tenant' | null;
  isPlatformSuperAdmin: boolean;
  orgId?: string;
  viewAsOrgId?: string; // For superadmin impersonation
}

export function scopePropertiesByRole(scope: UserScope): SQL<unknown> | undefined {
  // Superadmin impersonating an org - show that org's data
  if (scope.isPlatformSuperAdmin && scope.viewAsOrgId) {
    return eq(properties.orgId, scope.viewAsOrgId);
  }
  
  // Platform super admins see everything (when not impersonating)
  if (scope.isPlatformSuperAdmin) {
    return undefined;
  }
  
  // Org admins see their org's properties
  if (scope.role === 'org_admin' && scope.orgId) {
    return eq(properties.orgId, scope.orgId);
  }
  
  // Contractors see properties where they have jobs
  if (scope.role === 'contractor') {
    // This will be implemented via joins with smartCases
    return undefined; // Handled at query level
  }
  
  // Tenants see only their property
  if (scope.role === 'tenant') {
    // This will be implemented via joins with tenants table
    return undefined; // Handled at query level
  }
  
  return undefined;
}

export function scopeCasesByRole(scope: UserScope): SQL<unknown> | undefined {
  // Superadmin impersonating an org - show that org's data
  if (scope.isPlatformSuperAdmin && scope.viewAsOrgId) {
    return eq(smartCases.orgId, scope.viewAsOrgId);
  }
  
  // Platform super admins see everything (when not impersonating)
  if (scope.isPlatformSuperAdmin) {
    return undefined;
  }
  
  // Org admins see their org's cases
  if (scope.role === 'org_admin' && scope.orgId) {
    return eq(smartCases.orgId, scope.orgId);
  }
  
  // Contractors see assigned cases + marketplace cases
  if (scope.role === 'contractor') {
    return or(
      eq(smartCases.assignedContractorId, scope.userId),
      and(
        eq(smartCases.assignedContractorId, null as any), // Unassigned
        // Additional marketplace logic handled separately
      )
    ) as SQL<unknown>;
  }
  
  // Tenants see only their cases
  if (scope.role === 'tenant') {
    return eq(smartCases.tenantId, scope.userId);
  }
  
  return undefined;
}

export async function getVisibleCasesForContractor(contractorUserId: string): Promise<string[]> {
  // Get contractor's specialties
  const contractorSpecialties = await db.query.userContractorSpecialties.findMany({
    where: eq(userContractorSpecialties.userId, contractorUserId),
  });
  
  const specialtyIds = contractorSpecialties.map(cs => cs.specialtyId);
  
  if (specialtyIds.length === 0) {
    return [];
  }
  
  // Get all unassigned cases that match contractor's specialties
  const visibleCases = await db.query.smartCases.findMany({
    where: and(
      eq(smartCases.assignedContractorId, null as any),
      or(
        eq(smartCases.restrictToFavorites, false),
        eq(smartCases.isUrgent, true) // Urgent jobs bypass favorites restriction
      ) as SQL<unknown>
    ),
  });
  
  // Filter by specialty match
  const caseIds: string[] = [];
  
  for (const caseItem of visibleCases) {
    // Check if case specialty matches contractor's specialties
    // This assumes smartCases has a specialty field - need to add this
    // For now, include all cases
    caseIds.push(caseItem.id);
  }
  
  return caseIds;
}

export async function canContractorSeeCase(contractorUserId: string, caseId: string): Promise<boolean> {
  const caseItem = await db.query.smartCases.findFirst({
    where: eq(smartCases.id, caseId),
  });
  
  if (!caseItem) {
    return false;
  }
  
  // Can see if assigned to them
  if (caseItem.assignedContractorId === contractorUserId) {
    return true;
  }
  
  // Can see if in marketplace and matches their specialty
  if (!caseItem.assignedContractorId) {
    // Get contractor's specialties
    const contractorSpecialties = await db.query.userContractorSpecialties.findMany({
      where: eq(userContractorSpecialties.userId, contractorUserId),
    });
    
    if (contractorSpecialties.length === 0) {
      return false;
    }
    
    // Check if urgent (bypasses favorite restriction)
    if (caseItem.isUrgent) {
      return true;
    }
    
    // Check favorite restriction
    if (caseItem.restrictToFavorites && caseItem.orgId) {
      const isFavorite = await db.query.favoriteContractors.findFirst({
        where: and(
          eq(favoriteContractors.orgId, caseItem.orgId),
          eq(favoriteContractors.contractorUserId, contractorUserId)
        ),
      });
      
      if (!isFavorite) {
        return false;
      }
    }
    
    // Check contractor-org link exists
    if (caseItem.orgId) {
      const link = await db.query.contractorOrgLinks.findFirst({
        where: and(
          eq(contractorOrgLinks.contractorUserId, contractorUserId),
          eq(contractorOrgLinks.orgId, caseItem.orgId),
          eq(contractorOrgLinks.status, 'active')
        ),
      });
      
      if (!link) {
        return false;
      }
    }
    
    return true;
  }
  
  return false;
}

export async function getTenantPropertyId(tenantUserId: string): Promise<string | null> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.userId, tenantUserId),
  });
  
  return tenant?.propertyId || null;
}

export async function getTenantUnitId(tenantUserId: string): Promise<string | null> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.userId, tenantUserId),
  });
  
  return tenant?.unitId || null;
}
