import { db } from '../db';
import { smartCases, properties, units, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Get role-scoped data for Maya AI
 * - Platform admins: Full org context
 * - Org admins (landlords): Full org context (properties, tenants, cases)
 * - Contractors: Only assigned job context (no portfolio/financial data)
 * - Tenants: Only their unit and their own cases
 */

interface MayaScopedContext {
  role: 'platform_super_admin' | 'org_admin' | 'contractor' | 'tenant';
  caseId?: string;
  propertyContext?: any;
  unitContext?: any;
  tenantContext?: any;
  jobContext?: any;
  portfolioAccess: boolean;
}

export async function getMayaScopedContext(
  userId: string,
  userRole: 'platform_super_admin' | 'org_admin' | 'contractor' | 'tenant',
  caseId?: string
): Promise<MayaScopedContext> {
  
  // Platform admins get full access
  if (userRole === 'platform_super_admin') {
    const caseData = caseId ? await db.query.smartCases.findFirst({
      where: eq(smartCases.id, caseId),
      with: { property: true, unit: true, tenant: true },
    }) : null;

    return {
      role: userRole,
      caseId,
      propertyContext: caseData?.property,
      unitContext: caseData?.unit,
      tenantContext: caseData?.tenant,
      portfolioAccess: true,
    };
  }

  // Org admins (landlords) get full org context
  if (userRole === 'org_admin') {
    const caseData = caseId ? await db.query.smartCases.findFirst({
      where: eq(smartCases.id, caseId),
      with: { property: true, unit: true, tenant: true },
    }) : null;

    return {
      role: userRole,
      caseId,
      propertyContext: caseData?.property,
      unitContext: caseData?.unit,
      tenantContext: caseData?.tenant,
      portfolioAccess: true,
    };
  }

  // Contractors get ONLY job-specific context - NO portfolio access
  if (userRole === 'contractor') {
    if (!caseId) {
      return {
        role: userRole,
        portfolioAccess: false,
      };
    }

    const caseData = await db.query.smartCases.findFirst({
      where: eq(smartCases.id, caseId),
      with: { property: true, unit: true }, // NO financial data, NO tenant personal info beyond contact
    });

    if (!caseData) {
      return {
        role: userRole,
        caseId,
        portfolioAccess: false,
      };
    }

    // CRITICAL SECURITY CHECK: Verify contractor is assigned to this job
    // This prevents contractors from accessing arbitrary case data
    if (caseData.assignedContractorId !== userId) {
      console.error('Contractor attempted to access unassigned case:', {
        contractorId: userId,
        caseId,
        assignedContractorId: caseData.assignedContractorId,
      });
      return {
        role: userRole,
        caseId,
        portfolioAccess: false,
        // Return no job context - access denied
      };
    }

    return {
      role: userRole,
      caseId,
      jobContext: {
        caseId: caseData.id,
        title: caseData.title,
        description: caseData.description,
        status: caseData.status,
        priority: caseData.priority,
        property: {
          // Only property address for job location - NO financial/portfolio data
          street: caseData.property?.street,
          city: caseData.property?.city,
          state: caseData.property?.state,
          zip: caseData.property?.zip,
        },
        unit: caseData.unit ? {
          unitNumber: caseData.unit.unitNumber,
          floor: caseData.unit.floor,
        } : null,
      },
      portfolioAccess: false, // CRITICAL: No portfolio access
    };
  }

  // Tenants get ONLY their unit and their own cases
  if (userRole === 'tenant') {
    const tenantRecord = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
      with: {
        unit: {
          with: {
            property: true,
          },
        },
      },
    });

    if (!tenantRecord) {
      return {
        role: userRole,
        portfolioAccess: false,
      };
    }

    const caseData = caseId ? await db.query.smartCases.findFirst({
      where: eq(smartCases.id, caseId),
    }) : null;

    return {
      role: userRole,
      caseId,
      unitContext: tenantRecord.unit,
      propertyContext: {
        // Only basic property info for context
        name: tenantRecord.unit?.property?.name,
        street: tenantRecord.unit?.property?.street,
        city: tenantRecord.unit?.property?.city,
        state: tenantRecord.unit?.property?.state,
      },
      jobContext: caseData ? {
        caseId: caseData.id,
        title: caseData.title,
        description: caseData.description,
        status: caseData.status,
      } : undefined,
      portfolioAccess: false,
    };
  }

  // Default: No access
  return {
    role: userRole,
    portfolioAccess: false,
  };
}

/**
 * Build role-specific Maya AI system prompts
 */
export function buildMayaSystemPrompt(context: MayaScopedContext): string {
  const basePrompt = "You are Maya, a helpful AI assistant for property management.";

  if (context.role === 'platform_super_admin' || context.role === 'org_admin') {
    return `${basePrompt} You have full access to help with property management, tenant issues, financial tracking, and maintenance coordination. You can see all organizational data and help make informed decisions.`;
  }

  if (context.role === 'contractor') {
    return `${basePrompt} You are assisting a contractor. You can only discuss the specific maintenance job they are assigned to. You do NOT have access to property financial information, portfolio data, or other unrelated cases. Focus strictly on helping them complete their assigned maintenance work efficiently and professionally.`;
  }

  if (context.role === 'tenant') {
    return `${basePrompt} You are assisting a tenant. You can help them with their unit maintenance requests, answer questions about their rental, and guide them through the tenant portal. You only have access to information about their specific unit and their submitted cases.`;
  }

  return basePrompt;
}
