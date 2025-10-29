import type { IStorage } from './storage';
import type { Tenant, Vendor as Contractor, Unit, Property } from '@shared/schema';

export interface IdentityMatch {
  type: 'tenant' | 'contractor' | 'unknown';
  tenant?: Tenant & { unit?: Unit; property?: Property };
  contractor?: Contractor;
  confidence: 'high' | 'medium' | 'low';
  requiresVerification: boolean;
  matchedBy: 'phone' | 'email' | 'both';
}

/**
 * Identity Matching Service
 * Maps phone numbers and email addresses to tenants/contractors in the system
 */
export class IdentityMatchingService {
  constructor(private storage: IStorage) {}

  /**
   * Attempt to identify who is contacting based on phone or email
   */
  async identifyContact(params: {
    phone?: string;
    email?: string;
    orgId: string;
  }): Promise<IdentityMatch> {
    const { phone, email, orgId } = params;

    if (!phone && !email) {
      return {
        type: 'unknown',
        confidence: 'low',
        requiresVerification: true,
        matchedBy: 'phone',
      };
    }

    // Normalize inputs
    const normalizedPhone = phone ? this.normalizePhone(phone) : undefined;
    const normalizedEmail = email?.toLowerCase().trim();

    // Try to match tenant first
    const tenantMatch = await this.matchTenant(orgId, normalizedPhone, normalizedEmail);
    if (tenantMatch) {
      return tenantMatch;
    }

    // Try to match contractor
    const contractorMatch = await this.matchContractor(orgId, normalizedPhone, normalizedEmail);
    if (contractorMatch) {
      return contractorMatch;
    }

    // No match found
    return {
      type: 'unknown',
      confidence: 'low',
      requiresVerification: true,
      matchedBy: phone ? 'phone' : 'email',
    };
  }

  /**
   * Match tenant by phone or email
   */
  private async matchTenant(
    orgId: string,
    phone?: string,
    email?: string
  ): Promise<IdentityMatch | null> {
    try {
      // Get all tenant groups for the organization
      const tenantGroups = await this.storage.getTenantGroups(orgId);
      
      // Get all tenants for each group
      const allTenants: Tenant[] = [];
      for (const group of tenantGroups) {
        const groupTenants = await this.storage.getTenantsInGroup(group.id);
        allTenants.push(...groupTenants);
      }

      let matchedTenant: Tenant | undefined;
      let matchedBy: 'phone' | 'email' | 'both' | undefined;

      // Try exact match by both phone and email
      if (phone && email) {
        matchedTenant = allTenants.find(
          (t) =>
            t.status === 'Active' &&
            this.normalizePhone(t.phone) === phone &&
            t.email?.toLowerCase() === email
        );
        if (matchedTenant) {
          matchedBy = 'both';
        }
      }

      // Try match by phone only
      if (!matchedTenant && phone) {
        matchedTenant = allTenants.find(
          (t) =>
            t.status === 'Active' &&
            this.normalizePhone(t.phone) === phone
        );
        if (matchedTenant) {
          matchedBy = 'phone';
        }
      }

      // Try match by email only
      if (!matchedTenant && email) {
        matchedTenant = allTenants.find(
          (t) =>
            t.status === 'Active' &&
            t.email?.toLowerCase() === email
        );
        if (matchedTenant) {
          matchedBy = 'email';
        }
      }

      if (!matchedTenant || !matchedBy) {
        return null;
      }

      // Get tenant's unit and property information
      let unit: Unit | undefined;
      let property: Property | undefined;

      if (matchedTenant.groupId) {
        const tenantGroup = await this.storage.getTenantGroup(matchedTenant.groupId);
        if (tenantGroup) {
          // Get all leases for the organization
          const leases = await this.storage.getLeases(orgId);
          const tenantLeases = leases.filter(l => l.tenantGroupId === tenantGroup.id);
          const activeLease = tenantLeases.find(l => l.status === 'Active');
          
          if (activeLease) {
            unit = await this.storage.getUnit(activeLease.unitId);
            if (unit) {
              property = await this.storage.getProperty(unit.propertyId);
            }
          }
        }
      }

      return {
        type: 'tenant',
        tenant: { ...matchedTenant, unit, property },
        confidence: matchedBy === 'both' ? 'high' : 'medium',
        requiresVerification: matchedBy !== 'both',
        matchedBy,
      };
    } catch (error) {
      console.error('Error matching tenant:', error);
      return null;
    }
  }

  /**
   * Match contractor by phone or email
   */
  private async matchContractor(
    orgId: string,
    phone?: string,
    email?: string
  ): Promise<IdentityMatch | null> {
    try {
      // Get all contractors for the organization
      const contractors = await this.storage.getVendors(orgId);

      let matchedContractor: Contractor | undefined;
      let matchedBy: 'phone' | 'email' | 'both' | undefined;

      // Try exact match by both phone and email
      if (phone && email) {
        matchedContractor = contractors.find(
          (c) =>
            this.normalizePhone(c.phone) === phone &&
            c.email?.toLowerCase() === email
        );
        if (matchedContractor) {
          matchedBy = 'both';
        }
      }

      // Try match by phone only
      if (!matchedContractor && phone) {
        matchedContractor = contractors.find(
          (c) => this.normalizePhone(c.phone) === phone
        );
        if (matchedContractor) {
          matchedBy = 'phone';
        }
      }

      // Try match by email only
      if (!matchedContractor && email) {
        matchedContractor = contractors.find(
          (c) => c.email?.toLowerCase() === email
        );
        if (matchedContractor) {
          matchedBy = 'email';
        }
      }

      if (!matchedContractor || !matchedBy) {
        return null;
      }

      return {
        type: 'contractor',
        contractor: matchedContractor,
        confidence: matchedBy === 'both' ? 'high' : 'medium',
        requiresVerification: matchedBy !== 'both',
        matchedBy,
      };
    } catch (error) {
      console.error('Error matching contractor:', error);
      return null;
    }
  }

  /**
   * Normalize phone number to E.164 format or just digits
   * Handles various formats: +1234567890, (123) 456-7890, 123-456-7890, etc.
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If it starts with 1 and has 11 digits (US format), keep it
    // Otherwise just return the digits
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits;
    }
    
    // If it has 10 digits, prepend 1 (US format)
    if (digits.length === 10) {
      return '1' + digits;
    }
    
    return digits;
  }

  /**
   * Generate friendly verification message for unknown contacts
   */
  generateVerificationPrompt(identity: IdentityMatch): string {
    if (identity.type === 'tenant' && identity.tenant) {
      const { tenant } = identity;
      const name = `${tenant.firstName} ${tenant.lastName}`;
      const unit = tenant.unit?.label;
      const property = tenant.property?.name;

      if (unit && property) {
        return `Hi ${name}! Just to confirm, you're in ${property}, Unit ${unit}, correct?`;
      } else if (property) {
        return `Hi ${name}! Just to confirm, you're at ${property}, correct?`;
      } else {
        return `Hi ${name}! Just to confirm this is you reaching out, correct?`;
      }
    }

    if (identity.type === 'contractor' && identity.contractor) {
      const { contractor } = identity;
      return `Hi ${contractor.name}! Just confirming this is you checking in about a job, correct?`;
    }

    // Unknown contact
    return "Hi! I'm Maya, your property assistant. To help you better, could you tell me which unit you're in? For example: 'Unit 3B' or 'Building 1, Unit 2'.";
  }
}
