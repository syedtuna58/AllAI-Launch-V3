import {
  users,
  organizations,
  organizationMembers,
  ownershipEntities,
  properties,
  propertyOwnerships,
  units,
  unitAppliances,
  tenantGroups,
  tenants,
  leases,
  assets,
  smartCases,
  caseMedia,
  caseEvents,
  vendors,
  camCategories,
  transactions,
  transactionLineItems,
  camEntries,
  reminders,
  regulatoryRules,
  notifications,
  threads,
  messages,
  contractorAvailability,
  contractorBlackouts,
  quotes,
  quoteLineItems,
  appointments,
  triageConversations,
  triageMessages,
  userCategories,
  userCategoryMembers,
  messageThreads,
  chatMessages,
  threadParticipants,
  approvalPolicies,
  appointmentProposals,
  proposalSlots,
  channelMessages,
  equipmentFailures,
  predictiveInsights,
  channelSettings,
  equipment,
  type User,
  type UpsertUser,
  type Organization,
  type InsertOrganization,
  type OwnershipEntity,
  type InsertOwnershipEntity,
  type Property,
  type InsertProperty,
  type Unit,
  type InsertUnit,
  type TenantGroup,
  type InsertTenantGroup,
  type Tenant,
  type InsertTenant,
  type Lease,
  type InsertLease,
  type Asset,
  type InsertAsset,
  type SmartCase,
  type InsertSmartCase,
  type Vendor,
  type InsertVendor,
  type Transaction,
  type TransactionLineItem,
  type InsertTransaction,
  type InsertTransactionLineItem,
  type InsertExpense,
  type Reminder,
  type InsertReminder,
  type Notification,
  type ContractorAvailability,
  type InsertContractorAvailability,
  type ContractorBlackout,
  type InsertContractorBlackout,
  type Quote,
  type InsertQuote,
  type QuoteLineItem,
  type InsertQuoteLineItem,
  type Appointment,
  type InsertAppointment,
  type TriageConversation,
  type InsertTriageConversation,
  type TriageMessage,
  type InsertTriageMessage,
  type UserCategory,
  type InsertUserCategory,
  type UserCategoryMember,
  type InsertUserCategoryMember,
  type MessageThread,
  type InsertMessageThread,
  type ChatMessage,
  type InsertChatMessage,
  type ThreadParticipant,
  type InsertThreadParticipant,
  type ApprovalPolicy,
  type InsertApprovalPolicy,
  type AppointmentProposal,
  type InsertAppointmentProposal,
  type ProposalSlot,
  type InsertProposalSlot,
  type ChannelMessage,
  type InsertChannelMessage,
  type EquipmentFailure,
  type InsertEquipmentFailure,
  type PredictiveInsight,
  type InsertPredictiveInsight,
  type ChannelSettings,
  type InsertChannelSettings,
  type Equipment,
  type InsertEquipment,
  teams,
  scheduledJobs,
  counterProposals,
  type Team,
  type InsertTeam,
  type ScheduledJob,
  type InsertScheduledJob,
  type CounterProposal,
  type InsertCounterProposal,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, sql, gte, lte, count, like } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Organization operations
  getUserOrganization(userId: string): Promise<Organization | undefined>;
  getOrganization(orgId: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  
  // Ownership entity operations
  getOwnershipEntities(orgId: string): Promise<OwnershipEntity[]>;
  createOwnershipEntity(entity: InsertOwnershipEntity): Promise<OwnershipEntity>;
  updateOwnershipEntity(id: string, entity: Partial<InsertOwnershipEntity>): Promise<OwnershipEntity>;
  deleteOwnershipEntity(id: string): Promise<void>;
  getEntityPerformance(entityId: string, orgId: string): Promise<any>;
  getEntityPropertyCount(entityId: string, orgId: string): Promise<{ count: number; properties: Array<{id: string, name: string}> }>;
  getTenantRelationshipCount(tenantId: string, orgId: string): Promise<{ count: number; relationships: Array<{type: string, description: string}> }>;
  
  // Property operations
  getProperties(orgId: string): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  createPropertyWithOwnerships(property: InsertProperty, ownerships: Array<{entityId: string, percent: number}>): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property>;
  updatePropertyWithOwnerships(id: string, property: Partial<InsertProperty>, ownerships: Array<{entityId: string, percent: number}>): Promise<Property>;
  deleteProperty(id: string): Promise<void>;
  
  // Unit operations
  getUnits(propertyId: string): Promise<Unit[]>;
  getUnit(id: string): Promise<Unit | undefined>;
  createUnit(unit: InsertUnit): Promise<Unit>;
  updateUnit(id: string, unit: Partial<InsertUnit>): Promise<Unit>;
  deleteUnit(id: string): Promise<void>;
  
  // Tenant operations
  getTenantGroups(orgId: string): Promise<TenantGroup[]>;
  getTenantGroup(id: string): Promise<TenantGroup | undefined>;
  createTenantGroup(group: InsertTenantGroup): Promise<TenantGroup>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenantGroup(id: string, updates: Partial<InsertTenantGroup>): Promise<TenantGroup>;
  updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant>;
  archiveTenantGroup(id: string): Promise<TenantGroup>;
  unarchiveTenantGroup(id: string): Promise<TenantGroup>;
  deleteTenant(id: string): Promise<void>;
  deleteTenantGroup(id: string): Promise<void>;
  getTenantsInGroup(groupId: string): Promise<Tenant[]>;
  archiveTenant(id: string): Promise<Tenant>;
  unarchiveTenant(id: string): Promise<Tenant>;
  permanentDeleteTenant(id: string): Promise<void>;
  
  // Lease operations
  getLeases(orgId: string): Promise<Lease[]>;
  getLease(id: string): Promise<Lease | undefined>;
  getActiveLease(unitId: string): Promise<Lease | undefined>;
  createLease(lease: InsertLease): Promise<Lease>;
  updateLease(id: string, lease: Partial<InsertLease>): Promise<Lease>;
  
  // Smart Case operations
  getSmartCases(orgId: string): Promise<SmartCase[]>;
  getSmartCase(id: string): Promise<SmartCase | undefined>;
  createSmartCase(smartCase: InsertSmartCase): Promise<SmartCase>;
  updateSmartCase(id: string, smartCase: Partial<InsertSmartCase>): Promise<SmartCase>;
  deleteSmartCase(id: string): Promise<void>;
  
  // Asset operations
  getAssets(propertyId?: string, unitId?: string): Promise<Asset[]>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  
  // Vendor operations
  getVendors(orgId: string): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  
  // Transaction operations
  getTransactions(orgId: string, type?: "Income" | "Expense"): Promise<Transaction[]>;
  getTransactionById(id: string): Promise<Transaction | undefined>;
  getTransactionsByEntity(entityId: string): Promise<Transaction[]>;
  getTransactionsByProperty(propertyId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  deleteRecurringTransaction(id: string, mode: "future" | "all"): Promise<void>;
  updateRecurringTransaction(id: string, transaction: Partial<InsertTransaction>, mode: "future" | "all"): Promise<void>;
  updateTransactionPaymentStatus(id: string, paymentStatus: string): Promise<void>;
  createExpense(expense: InsertExpense): Promise<Transaction>;
  getTransactionLineItems(transactionId: string): Promise<TransactionLineItem[]>;
  
  // Reminder operations
  getReminders(orgId: string): Promise<Reminder[]>;
  getDueReminders(): Promise<Reminder[]>;
  createReminder(reminder: InsertReminder): Promise<Reminder>;
  updateReminder(id: string, reminder: Partial<InsertReminder>): Promise<Reminder>;
  deleteReminder(id: string): Promise<void>;
  deleteRecurringReminder(id: string, mode: "future" | "all"): Promise<void>;
  updateRecurringReminder(id: string, data: Partial<InsertReminder>, mode: "future" | "all"): Promise<Reminder>;
  
  // Notification operations
  getUserNotifications(userId: string): Promise<Notification[]>;
  createNotification(userId: string, title: string, message: string, type?: string, targetRole?: string, targetName?: string): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  
  // Dashboard operations
  getDashboardStats(orgId: string): Promise<{
    totalProperties: number;
    monthlyRevenue: number;
    openCases: number;
    dueReminders: number;
  }>;
  
  getRentCollectionStatus(orgId: string): Promise<{
    collected: number;
    total: number;
    percentage: number;
    items: Array<{
      id: string;
      property: string;
      tenant: string;
      amount: number;
      status: "paid" | "due" | "overdue";
      dueDate: Date;
    }>;
  }>;
  
  // Contractor operations
  getContractors(orgId: string): Promise<Vendor[]>;
  getContractor(id: string): Promise<Vendor | undefined>;
  getContractorByUserId(userId: string): Promise<Vendor | undefined>;
  getContractorVendorsByUserId(userId: string): Promise<Vendor[]>; // Get all vendor records for a contractor across orgs
  updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor>;
  
  // Contractor Availability operations
  getContractorAvailability(contractorId: string): Promise<ContractorAvailability[]>;
  createContractorAvailability(availability: InsertContractorAvailability): Promise<ContractorAvailability>;
  updateContractorAvailability(id: string, availability: Partial<InsertContractorAvailability>): Promise<ContractorAvailability>;
  deleteContractorAvailability(id: string): Promise<void>;
  
  // Contractor Blackout operations
  getContractorBlackouts(contractorId: string): Promise<ContractorBlackout[]>;
  createContractorBlackout(blackout: InsertContractorBlackout): Promise<ContractorBlackout>;
  updateContractorBlackout(id: string, blackout: Partial<InsertContractorBlackout>): Promise<ContractorBlackout>;
  deleteContractorBlackout(id: string): Promise<void>;
  
  // Quote operations
  getContractorQuotes(contractorId: string): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuoteWithLineItems(id: string): Promise<{ quote: Quote; lineItems: QuoteLineItem[] } | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote>;
  updateQuoteWithLineItems(id: string, quote: Partial<InsertQuote>, lineItems: InsertQuoteLineItem[]): Promise<{ quote: Quote; lineItems: QuoteLineItem[] }>;
  deleteQuote(id: string): Promise<void>;
  getQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]>;
  createQuoteLineItem(lineItem: InsertQuoteLineItem): Promise<QuoteLineItem>;
  updateQuoteLineItem(id: string, lineItem: Partial<InsertQuoteLineItem>): Promise<QuoteLineItem>;
  deleteQuoteLineItem(id: string): Promise<void>;
  
  // Appointment operations
  getAppointments(orgId: string): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  getContractorAppointments(contractorId: string): Promise<Appointment[]>;
  getCaseAppointments(caseId: string): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment>;
  deleteAppointment(id: string): Promise<void>;
  
  // AI Triage operations
  getTriageConversation(id: string): Promise<TriageConversation | undefined>;
  createTriageConversation(conversation: InsertTriageConversation): Promise<string>;
  updateTriageConversation(id: string, conversation: Partial<InsertTriageConversation>): Promise<TriageConversation>;
  getTriageMessages(conversationId: string): Promise<TriageMessage[]>;
  createTriageMessage(message: InsertTriageMessage): Promise<TriageMessage>;
  
  // User Category operations
  getUserCategories(orgId: string): Promise<UserCategory[]>;
  getUserCategory(id: string): Promise<UserCategory | undefined>;
  createUserCategory(category: InsertUserCategory): Promise<UserCategory>;
  updateUserCategory(id: string, category: Partial<InsertUserCategory>): Promise<UserCategory>;
  deleteUserCategory(id: string): Promise<void>;
  
  // User Category Member operations
  getCategoryMembers(categoryId: string): Promise<UserCategoryMember[]>;
  getUserCategoryMemberships(userId: string): Promise<UserCategoryMember[]>;
  addCategoryMember(member: InsertUserCategoryMember): Promise<UserCategoryMember>;
  removeCategoryMember(categoryId: string, userId: string): Promise<void>;
  
  // Messaging operations
  getMessageThreads(orgId: string, userId: string): Promise<MessageThread[]>;
  getMessageThread(id: string): Promise<MessageThread | undefined>;
  createMessageThread(thread: InsertMessageThread, participantIds: string[]): Promise<MessageThread>;
  getThreadMessages(threadId: string): Promise<ChatMessage[]>;
  sendMessage(message: InsertChatMessage): Promise<ChatMessage>;
  markThreadAsRead(threadId: string, userId: string): Promise<void>;
  
  // Approval Policy operations
  getApprovalPolicies(orgId: string): Promise<ApprovalPolicy[]>;
  getApprovalPolicy(id: string): Promise<ApprovalPolicy | undefined>;
  createApprovalPolicy(policy: InsertApprovalPolicy): Promise<ApprovalPolicy>;
  updateApprovalPolicy(id: string, policy: Partial<InsertApprovalPolicy>): Promise<ApprovalPolicy>;
  deleteApprovalPolicy(id: string): Promise<void>;
  
  // Appointment Proposal operations
  getAppointmentProposals(caseId: string): Promise<AppointmentProposal[]>;
  getAppointmentProposal(id: string): Promise<AppointmentProposal | undefined>;
  createAppointmentProposal(proposal: InsertAppointmentProposal): Promise<AppointmentProposal>;
  updateAppointmentProposal(id: string, proposal: Partial<InsertAppointmentProposal>): Promise<AppointmentProposal>;
  deleteAppointmentProposal(id: string): Promise<void>;
  
  // Proposal Slot operations
  getProposalSlots(proposalId: string): Promise<ProposalSlot[]>;
  getProposalSlot(id: string): Promise<ProposalSlot | undefined>;
  createProposalSlot(slot: InsertProposalSlot): Promise<ProposalSlot>;
  deleteProposalSlot(id: string): Promise<void>;
  
  // Omnichannel Communication operations
  getChannelMessages(orgId: string, filters?: { channelType?: string; status?: string; tenantId?: string; contractorId?: string; externalId?: string }): Promise<ChannelMessage[]>;
  getChannelMessage(id: string): Promise<ChannelMessage | undefined>;
  createChannelMessage(message: InsertChannelMessage): Promise<ChannelMessage>;
  updateChannelMessage(id: string, message: Partial<InsertChannelMessage>): Promise<ChannelMessage>;
  
  // Equipment Failure operations
  getEquipmentFailures(orgId: string, filters?: { equipmentType?: string; propertyId?: string; unitId?: string }): Promise<EquipmentFailure[]>;
  createEquipmentFailure(failure: InsertEquipmentFailure): Promise<EquipmentFailure>;
  
  // Predictive Insights operations
  getPredictiveInsights(orgId: string, filters?: { isActive?: boolean; insightType?: string }): Promise<PredictiveInsight[]>;
  createPredictiveInsight(insight: InsertPredictiveInsight): Promise<PredictiveInsight>;
  updatePredictiveInsight(id: string, insight: Partial<InsertPredictiveInsight>): Promise<PredictiveInsight>;
  
  // Channel Settings operations
  getChannelSettings(orgId: string): Promise<ChannelSettings | undefined>;
  updateChannelSettings(orgId: string, settings: Partial<InsertChannelSettings>): Promise<ChannelSettings>;
  
  // Equipment operations
  getEquipment(propertyId: string): Promise<Equipment[]>;
  getEquipmentById(id: string): Promise<Equipment | undefined>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: string, equipment: Partial<InsertEquipment>): Promise<Equipment>;
  deleteEquipment(id: string): Promise<void>;
  getOrgEquipment(orgId: string): Promise<Equipment[]>;

  // Team operations
  getTeams(orgId: string): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team>;
  deleteTeam(id: string): Promise<void>;

  // Scheduled Job operations
  getScheduledJobs(orgId: string, filters?: { teamId?: string; status?: string; caseId?: string }): Promise<ScheduledJob[]>;
  getScheduledJob(id: string): Promise<ScheduledJob | undefined>;
  createScheduledJob(job: InsertScheduledJob): Promise<ScheduledJob>;
  updateScheduledJob(id: string, job: Partial<InsertScheduledJob>): Promise<ScheduledJob>;
  deleteScheduledJob(id: string): Promise<void>;

  // Counter-Proposal operations
  createCounterProposal(proposal: InsertCounterProposal): Promise<CounterProposal>;
  getCounterProposalsByJob(jobId: string): Promise<CounterProposal[]>;
  getCounterProposal(id: string): Promise<CounterProposal | undefined>;
  updateCounterProposal(id: string, proposal: Partial<InsertCounterProposal>): Promise<CounterProposal>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Organization operations
  async getUserOrganization(userId: string): Promise<Organization | undefined> {
    const [org] = await db
      .select()
      .from(organizations)
      .leftJoin(organizationMembers, eq(organizations.id, organizationMembers.orgId))
      .where(eq(organizationMembers.userId, userId))
      .limit(1);
    
    return org?.organizations;
  }

  async getOrganization(orgId: string): Promise<Organization | undefined> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    
    return org;
  }

  async createOrganization(orgData: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(orgData).returning();
    
    // Add the owner as an admin member
    await db.insert(organizationMembers).values({
      orgId: org.id,
      userId: org.ownerId,
      role: "admin",
    });
    
    return org;
  }

  // Ownership entity operations
  async getOwnershipEntities(orgId: string): Promise<OwnershipEntity[]> {
    return await db
      .select()
      .from(ownershipEntities)
      .where(eq(ownershipEntities.orgId, orgId))
      .orderBy(asc(ownershipEntities.name));
  }

  async createOwnershipEntity(entity: InsertOwnershipEntity): Promise<OwnershipEntity> {
    const [newEntity] = await db.insert(ownershipEntities).values(entity).returning();
    return newEntity;
  }

  async updateOwnershipEntity(id: string, entity: Partial<InsertOwnershipEntity>): Promise<OwnershipEntity> {
    const [updated] = await db
      .update(ownershipEntities)
      .set(entity)
      .where(eq(ownershipEntities.id, id))
      .returning();
    return updated;
  }

  async deleteOwnershipEntity(id: string): Promise<void> {
    // CASCADE DELETE: Clean up all related data to prevent FK violations
    
    // 1. Delete property ownerships for this entity
    await db.delete(propertyOwnerships).where(eq(propertyOwnerships.entityId, id));
    
    // 2. Delete transactions related to this entity
    await db.delete(transactions).where(eq(transactions.entityId, id));
    
    // 3. Delete reminders scoped to this entity
    await db.delete(reminders).where(and(eq(reminders.scope, "entity"), eq(reminders.scopeId, id)));
    
    // 4. Finally delete the entity itself
    await db.delete(ownershipEntities).where(eq(ownershipEntities.id, id));
  }

  async getEntityPerformance(entityId: string, orgId: string): Promise<any> {
    // Get the entity
    const [entity] = await db
      .select()
      .from(ownershipEntities)
      .where(and(eq(ownershipEntities.id, entityId), eq(ownershipEntities.orgId, orgId)));
    
    if (!entity) {
      return null;
    }

    // Get properties owned by this entity
    const propertiesResult = await db
      .select({
        id: properties.id,
        name: properties.name,
        type: properties.type,
        street: properties.street,
        city: properties.city,
        state: properties.state,
        ownershipPercent: propertyOwnerships.percent,
        propertyValue: properties.propertyValue,
        autoAppreciation: properties.autoAppreciation,
        appreciationRate: properties.appreciationRate,
        valueEntryDate: properties.valueEntryDate,
      })
      .from(properties)
      .innerJoin(propertyOwnerships, eq(properties.id, propertyOwnerships.propertyId))
      .where(and(
        eq(propertyOwnerships.entityId, entityId),
        eq(properties.orgId, orgId)
      ))
      .orderBy(asc(properties.name));

    // Calculate metrics using actual property values with auto-appreciation
    const totalProperties = propertiesResult.length;
    
    let totalValue = 0;
    let totalOwnershipValue = 0;
    
    const propertiesWithValues = propertiesResult.map(property => {
      let currentPropertyValue = 0;
      let hasCustomValue = false;
      
      // Only use properties with actual values set (no fallback defaults)
      if (property.propertyValue && Number(property.propertyValue) > 0) {
        currentPropertyValue = Number(property.propertyValue);
        hasCustomValue = true;
        
        // Apply auto-appreciation if enabled
        if (property.autoAppreciation && property.appreciationRate && property.valueEntryDate) {
          const entryDate = new Date(property.valueEntryDate);
          const currentDate = new Date();
          const yearsElapsed = Math.floor((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
          
          if (yearsElapsed > 0) {
            const appreciationRate = Number(property.appreciationRate) / 100; // Convert percentage to decimal
            currentPropertyValue = currentPropertyValue * Math.pow(1 + appreciationRate, yearsElapsed);
          }
        }
        
        const ownershipPercent = Number(property.ownershipPercent);
        const ownershipValue = currentPropertyValue * (ownershipPercent / 100);
        
        totalValue += currentPropertyValue;
        totalOwnershipValue += ownershipValue;
      }
      
      return {
        ...property,
        currentValue: Math.round(currentPropertyValue),
        hasCustomValue,
      };
    });

    // Simplified financial metrics (in a real app, these would come from actual lease/expense data)
    const avgOwnershipPercent = totalProperties > 0 ? 
      propertiesResult.reduce((sum, p) => sum + Number(p.ownershipPercent), 0) / totalProperties : 0;
    const monthlyRevenue = totalProperties * 2000 * (avgOwnershipPercent / 100);
    const monthlyExpenses = totalProperties * 500 * (avgOwnershipPercent / 100);
    const netCashFlow = monthlyRevenue - monthlyExpenses;

    return {
      entity,
      properties: propertiesWithValues,
      metrics: {
        totalProperties,
        totalValue,
        monthlyRevenue: Math.round(monthlyRevenue),
        monthlyExpenses: Math.round(monthlyExpenses),
        netCashFlow: Math.round(netCashFlow),
        totalOwnershipValue: Math.round(totalOwnershipValue),
      },
    };
  }

  async getEntityPropertyCount(entityId: string, orgId: string): Promise<{ count: number; properties: Array<{id: string, name: string}> }> {
    // Get properties owned by this entity
    const propertiesResult = await db
      .select({
        id: properties.id,
        name: properties.name,
      })
      .from(properties)
      .innerJoin(propertyOwnerships, eq(properties.id, propertyOwnerships.propertyId))
      .where(and(
        eq(propertyOwnerships.entityId, entityId),
        eq(properties.orgId, orgId)
      ))
      .orderBy(asc(properties.name));

    return {
      count: propertiesResult.length,
      properties: propertiesResult
    };
  }

  async getTenantRelationshipCount(tenantId: string, orgId: string): Promise<{ 
    count: number; 
    relationships: Array<{type: string, description: string}>
  }> {
    const relationships: Array<{type: string, description: string}> = [];

    // Check for active leases through tenant group
    const tenant = await db
      .select({ groupId: tenants.groupId })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    
    if (tenant[0]?.groupId) {
      const leasesResult = await db
        .select({
          id: leases.id,
          rent: leases.rent,
          startDate: leases.startDate,
          endDate: leases.endDate,
          status: leases.status
        })
        .from(leases)
        .where(eq(leases.tenantGroupId, tenant[0].groupId));

      leasesResult.forEach(lease => {
        relationships.push({
          type: 'lease',
          description: `${lease.status} lease: $${lease.rent}/month (${lease.startDate?.toLocaleDateString()} - ${lease.endDate?.toLocaleDateString()})`
        });
      });
    }

    // Check for transactions related to the tenant (through tenant scope or description)
    const transactionsResult = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        date: transactions.date
      })
      .from(transactions)
      .where(and(
        eq(transactions.orgId, orgId),
        // Check if transaction mentions this tenant ID in scope or description
        or(
          like(transactions.scope, `%${tenantId}%`),
          like(transactions.description, `%${tenantId}%`)
        )
      ));

    transactionsResult.forEach(transaction => {
      relationships.push({
        type: 'transaction',
        description: `${transaction.type}: $${transaction.amount} - ${transaction.description}`
      });
    });

    return {
      count: relationships.length,
      relationships: relationships
    };
  }

  async getPropertyPerformance(propertyId: string, orgId: string): Promise<any> {
    // Get the property
    const [property] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.orgId, orgId)));
    
    if (!property) {
      return null;
    }

    // Get ownership entities for this property
    const entitiesResult = await db
      .select({
        id: ownershipEntities.id,
        name: ownershipEntities.name,
        type: ownershipEntities.type,
        ownershipPercent: propertyOwnerships.percent,
      })
      .from(ownershipEntities)
      .innerJoin(propertyOwnerships, eq(ownershipEntities.id, propertyOwnerships.entityId))
      .where(and(
        eq(propertyOwnerships.propertyId, propertyId),
        eq(ownershipEntities.orgId, orgId)
      ))
      .orderBy(asc(ownershipEntities.name));

    // Get units for this property
    const unitsResult = await db
      .select({
        id: units.id,
        label: units.label,
        bedrooms: units.bedrooms,
        bathrooms: units.bathrooms,
        sqft: units.sqft,
        rentAmount: units.rentAmount,
      })
      .from(units)
      .where(eq(units.propertyId, propertyId))
      .orderBy(asc(units.label));

    // Calculate current property value with auto-appreciation
    let currentValue = 0;
    const estimatedValue = property.propertyValue ? Number(property.propertyValue) : 0;
    
    if (estimatedValue > 0) {
      currentValue = estimatedValue;
      
      // Apply auto-appreciation if enabled
      if (property.autoAppreciation && property.appreciationRate && property.valueEntryDate) {
        const entryDate = new Date(property.valueEntryDate);
        const currentDate = new Date();
        const yearsElapsed = Math.floor((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
        
        if (yearsElapsed > 0) {
          const appreciationRate = Number(property.appreciationRate) / 100;
          currentValue = currentValue * Math.pow(1 + appreciationRate, yearsElapsed);
        }
      }
    }

    // Get actual revenue transactions for this property
    const currentDate = new Date();
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    // Get current month's revenue transactions with payment status
    const revenueTransactions = await db
      .select({
        amount: transactions.amount,
        date: transactions.date,
        paymentStatus: transactions.paymentStatus,
        isRecurring: transactions.isRecurring,
      })
      .from(transactions)
      .where(and(
        eq(transactions.orgId, orgId),
        eq(transactions.propertyId, propertyId),
        eq(transactions.type, "Income"),
        gte(transactions.date, currentMonthStart),
        lte(transactions.date, currentMonthEnd)
      ));

    // Calculate financial metrics
    const totalUnits = unitsResult.length;
    
    // Calculate expected monthly revenue from recurring revenue transactions
    const expectedMonthlyRevenue = revenueTransactions
      .filter(transaction => transaction.isRecurring)
      .reduce((sum, transaction) => {
        return sum + Number(transaction.amount);
      }, 0);
    
    // Calculate actual collected revenue (only Paid and Partial transactions)
    const actualMonthlyRevenue = revenueTransactions
      .filter(transaction => 
        transaction.paymentStatus === 'Paid' || 
        transaction.paymentStatus === 'Partial'
      )
      .reduce((sum, transaction) => {
        return sum + Number(transaction.amount);
      }, 0);
    
    // Calculate collection rate
    const collectionRate = expectedMonthlyRevenue > 0 
      ? Math.round((actualMonthlyRevenue / expectedMonthlyRevenue) * 100)
      : 0;

    // For backwards compatibility, use actual if available, otherwise expected
    const monthlyRevenue = actualMonthlyRevenue > 0 ? actualMonthlyRevenue : expectedMonthlyRevenue;
    
    // Simplified expense calculation (could be enhanced with actual expense data)
    const monthlyExpenses = Math.round(currentValue * 0.02 / 12); // 2% of property value annually
    const netCashFlow = monthlyRevenue - monthlyExpenses;
    const appreciationGain = currentValue - estimatedValue;

    return {
      property,
      entities: entitiesResult,
      units: unitsResult,
      metrics: {
        totalUnits,
        estimatedValue: Math.round(estimatedValue),
        currentValue: Math.round(currentValue),
        monthlyRevenue: Math.round(monthlyRevenue),
        expectedMonthlyRevenue: Math.round(expectedMonthlyRevenue),
        actualMonthlyRevenue: Math.round(actualMonthlyRevenue),
        collectionRate,
        monthlyExpenses,
        netCashFlow: Math.round(netCashFlow),
        appreciationGain: Math.round(appreciationGain),
        totalOwners: entitiesResult.length,
      },
    };
  }

  // Property operations
  async getProperties(orgId: string): Promise<Property[]> {
    const result = await db
      .select({
        id: properties.id,
        orgId: properties.orgId,
        name: properties.name,
        type: properties.type,
        street: properties.street,
        city: properties.city,
        state: properties.state,
        zipCode: properties.zipCode,
        country: properties.country,
        yearBuilt: properties.yearBuilt,
        sqft: properties.sqft,
        hoaName: properties.hoaName,
        hoaContact: properties.hoaContact,
        notes: properties.notes,
        createdAt: properties.createdAt,
        // Property value fields
        propertyValue: properties.propertyValue,
        autoAppreciation: properties.autoAppreciation,
        appreciationRate: properties.appreciationRate,
        valueEntryDate: properties.valueEntryDate,
        // Mortgage fields
        monthlyMortgage: properties.monthlyMortgage,
        interestRate: properties.interestRate,
        mortgageStartDate: properties.mortgageStartDate,
        monthlyMortgage2: properties.monthlyMortgage2,
        interestRate2: properties.interestRate2,
        mortgageStartDate2: properties.mortgageStartDate2,
        purchasePrice: properties.purchasePrice,
        downPayment: properties.downPayment,
        acquisitionDate: properties.acquisitionDate,
        saleDate: properties.saleDate,
        salePrice: properties.salePrice,
        status: properties.status,
        // Include ownership information
        ownershipEntityId: propertyOwnerships.entityId,
        ownershipPercent: propertyOwnerships.percent,
        entityName: ownershipEntities.name,
        entityType: ownershipEntities.type,
      })
      .from(properties)
      .leftJoin(propertyOwnerships, eq(properties.id, propertyOwnerships.propertyId))
      .leftJoin(ownershipEntities, eq(propertyOwnerships.entityId, ownershipEntities.id))
      .where(eq(properties.orgId, orgId))
      .orderBy(asc(properties.name));
    
    // Group by property and aggregate ownership information
    const propertiesMap = new Map();
    
    for (const row of result) {
      if (!propertiesMap.has(row.id)) {
        propertiesMap.set(row.id, {
          id: row.id,
          orgId: row.orgId,
          name: row.name,
          type: row.type,
          street: row.street,
          city: row.city,
          state: row.state,
          zipCode: row.zipCode,
          country: row.country,
          yearBuilt: row.yearBuilt,
          sqft: row.sqft,
          hoaName: row.hoaName,
          hoaContact: row.hoaContact,
          notes: row.notes,
          createdAt: row.createdAt,
          // Property value fields - ensure proper mapping
          propertyValue: row.propertyValue ? Number(row.propertyValue) : undefined,
          autoAppreciation: row.autoAppreciation || false,
          appreciationRate: row.appreciationRate ? Number(row.appreciationRate) : undefined,
          valueEntryDate: row.valueEntryDate,
          // Mortgage fields - these were missing from the properties list!
          monthlyMortgage: row.monthlyMortgage ? Number(row.monthlyMortgage) : undefined,
          interestRate: row.interestRate ? Number(row.interestRate) : undefined,
          mortgageStartDate: row.mortgageStartDate,
          monthlyMortgage2: row.monthlyMortgage2 ? Number(row.monthlyMortgage2) : undefined,
          interestRate2: row.interestRate2 ? Number(row.interestRate2) : undefined,
          mortgageStartDate2: row.mortgageStartDate2,
          purchasePrice: row.purchasePrice ? Number(row.purchasePrice) : undefined,
          downPayment: row.downPayment ? Number(row.downPayment) : undefined,
          acquisitionDate: row.acquisitionDate,
          saleDate: row.saleDate,
          salePrice: row.salePrice ? Number(row.salePrice) : undefined,
          status: row.status || "Active", // Add status field for archive functionality
          ownerships: []
        });
      }
      
      if (row.ownershipEntityId) {
        propertiesMap.get(row.id).ownerships.push({
          entityId: row.ownershipEntityId,
          percent: parseFloat(row.ownershipPercent || "0"),
          entityName: row.entityName,
          entityType: row.entityType,
        });
      }
    }
    
    return Array.from(propertiesMap.values());
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    const [newProperty] = await db.insert(properties).values(property).returning();
    return newProperty;
  }

  async createPropertyWithOwnerships(property: InsertProperty, ownerships: Array<{entityId: string, percent: number}>): Promise<Property> {
    // Set valueEntryDate automatically if property value is provided
    const propertyData = { ...property };
    if (propertyData.propertyValue && Number(propertyData.propertyValue) > 0 && !propertyData.valueEntryDate) {
      propertyData.valueEntryDate = new Date();
    }
    
    const [newProperty] = await db.insert(properties).values(propertyData).returning();
    
    // Create ownership records
    if (ownerships && ownerships.length > 0) {
      const ownershipRecords = ownerships.map(ownership => ({
        propertyId: newProperty.id,
        entityId: ownership.entityId,
        percent: ownership.percent.toString(),
      }));
      
      await db.insert(propertyOwnerships).values(ownershipRecords);
    }
    
    return newProperty;
  }

  async createPropertyWithOwnershipsAndUnit(
    property: InsertProperty, 
    ownerships: Array<{entityId: string, percent: number}>,
    defaultUnit?: {
      label: string;
      bedrooms?: number;
      bathrooms?: number;
      sqft?: number;
      rentAmount?: string;
      deposit?: string;
      notes?: string;
      hvacBrand?: string;
      hvacModel?: string;
      hvacYear?: number;
      hvacLifetime?: number;
      hvacReminder?: boolean;
      waterHeaterBrand?: string;
      waterHeaterModel?: string;
      waterHeaterYear?: number;
      waterHeaterLifetime?: number;
      waterHeaterReminder?: boolean;
      applianceNotes?: string;
      appliances?: Array<any>;
    }
  ): Promise<{property: Property, unit?: Unit}> {
    // First create the property with ownerships
    const newProperty = await this.createPropertyWithOwnerships(property, ownerships);
    
    let newUnit = undefined;
    if (defaultUnit) {
      // Create the default unit with appliance data
      const unitData: InsertUnit = {
        propertyId: newProperty.id,
        label: defaultUnit.label,
        bedrooms: defaultUnit.bedrooms,
        bathrooms: defaultUnit.bathrooms,
        sqft: defaultUnit.sqft,
        rentAmount: defaultUnit.rentAmount ? defaultUnit.rentAmount : undefined,
        deposit: defaultUnit.deposit ? defaultUnit.deposit : undefined,
        notes: defaultUnit.notes,
        hvacBrand: defaultUnit.hvacBrand,
        hvacModel: defaultUnit.hvacModel,
        hvacYear: defaultUnit.hvacYear,
        hvacLifetime: defaultUnit.hvacLifetime,
        hvacReminder: defaultUnit.hvacReminder,
        waterHeaterBrand: defaultUnit.waterHeaterBrand,
        waterHeaterModel: defaultUnit.waterHeaterModel,
        waterHeaterYear: defaultUnit.waterHeaterYear,
        waterHeaterLifetime: defaultUnit.waterHeaterLifetime,
        waterHeaterReminder: defaultUnit.waterHeaterReminder,
        applianceNotes: defaultUnit.applianceNotes,
      };
      
      newUnit = await this.createUnit(unitData);
      
      // Handle custom appliances
      if (defaultUnit.appliances && defaultUnit.appliances.length > 0) {
        for (const appliance of defaultUnit.appliances) {
          await this.createUnitAppliance({
            unitId: newUnit.id,
            name: appliance.name,
            manufacturer: appliance.manufacturer,
            model: appliance.model,
            year: appliance.year,
            expectedLifetime: appliance.expectedLifetime,
            alertBeforeExpiry: appliance.alertBeforeExpiry,
            notes: appliance.notes,
          });
        }
      }
    }
    
    return { property: newProperty, unit: newUnit };
  }

  // Create property with multiple units (for buildings)
  async createPropertyWithOwnershipsAndUnits(
    property: InsertProperty, 
    ownerships: Array<{entityId: string, percent: number}>,
    units: any[]
  ): Promise<{property: Property, units: Unit[]}> {
    // First create the property with ownerships
    const newProperty = await this.createPropertyWithOwnerships(property, ownerships);
    
    const createdUnits: Unit[] = [];
    
    // Create each unit
    for (const unitData of units) {
      const unitInsertData: InsertUnit = {
        propertyId: newProperty.id,
        label: unitData.label || 'Unit',
        bedrooms: unitData.bedrooms,
        bathrooms: unitData.bathrooms,
        sqft: unitData.sqft,
        rentAmount: unitData.rentAmount ? String(unitData.rentAmount) : undefined,
        deposit: unitData.deposit ? String(unitData.deposit) : undefined,
        notes: unitData.notes,
        hvacBrand: unitData.hvacBrand,
        hvacModel: unitData.hvacModel,
        hvacYear: unitData.hvacYear,
        hvacLifetime: unitData.hvacLifetime,
        hvacReminder: unitData.hvacReminder,
        waterHeaterBrand: unitData.waterHeaterBrand,
        waterHeaterModel: unitData.waterHeaterModel,
        waterHeaterYear: unitData.waterHeaterYear,
        waterHeaterLifetime: unitData.waterHeaterLifetime,
        waterHeaterReminder: unitData.waterHeaterReminder,
        applianceNotes: unitData.applianceNotes,
      };
      
      const newUnit = await this.createUnit(unitInsertData);
      createdUnits.push(newUnit);
      
      // Handle custom appliances for this unit
      if (unitData.appliances && unitData.appliances.length > 0) {
        for (const appliance of unitData.appliances) {
          await this.createUnitAppliance({
            unitId: newUnit.id,
            name: appliance.name,
            manufacturer: appliance.manufacturer,
            model: appliance.model,
            year: appliance.year,
            expectedLifetime: appliance.expectedLifetime,
            alertBeforeExpiry: appliance.alertBeforeExpiry,
            notes: appliance.notes,
          });
        }
      }
    }
    
    return { property: newProperty, units: createdUnits };
  }

  async updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property> {
    const [updated] = await db
      .update(properties)
      .set(property)
      .where(eq(properties.id, id))
      .returning();
    return updated;
  }

  async updatePropertyWithOwnerships(id: string, property: Partial<InsertProperty>, ownerships: Array<{entityId: string, percent: number}>): Promise<Property> {
    // Get current property to check if value is being set for the first time
    const [currentProperty] = await db
      .select({ propertyValue: properties.propertyValue, valueEntryDate: properties.valueEntryDate })
      .from(properties)
      .where(eq(properties.id, id));
    
    // Set valueEntryDate automatically if property value is being set for the first time
    const propertyData = { ...property };
    if (propertyData.propertyValue && Number(propertyData.propertyValue) > 0) {
      // Only set valueEntryDate if it's not already set or if the current property doesn't have a value
      if (!currentProperty?.valueEntryDate || !currentProperty?.propertyValue || Number(currentProperty.propertyValue) <= 0) {
        propertyData.valueEntryDate = new Date();
      }
    }
    
    // Update the property
    const [updated] = await db
      .update(properties)
      .set(propertyData)
      .where(eq(properties.id, id))
      .returning();
    
    // Delete existing ownerships
    await db.delete(propertyOwnerships).where(eq(propertyOwnerships.propertyId, id));
    
    // Create new ownership records
    if (ownerships && ownerships.length > 0) {
      const ownershipRecords = ownerships.map(ownership => ({
        propertyId: id,
        entityId: ownership.entityId,
        percent: ownership.percent.toString(),
      }));
      
      await db.insert(propertyOwnerships).values(ownershipRecords);
    }
    
    return updated;
  }

  async deleteProperty(id: string): Promise<void> {
    // CASCADE DELETE: Clean up all related data to prevent FK violations
    
    // 1. Delete property ownerships
    await db.delete(propertyOwnerships).where(eq(propertyOwnerships.propertyId, id));
    
    // 2. Get units for this property and delete them with their dependencies
    const propertyUnits = await db.select({ id: units.id }).from(units).where(eq(units.propertyId, id));
    
    for (const unit of propertyUnits) {
      // Delete unit appliances
      await db.delete(unitAppliances).where(eq(unitAppliances.unitId, unit.id));
      
      // Delete leases for this unit
      await db.delete(leases).where(eq(leases.unitId, unit.id));
    }
    
    // 3. Delete all units for this property
    await db.delete(units).where(eq(units.propertyId, id));
    
    // 4. Delete transactions related to this property
    await db.delete(transactions).where(eq(transactions.propertyId, id));
    
    // 5. Delete reminders scoped to this property
    await db.delete(reminders).where(and(eq(reminders.scope, "property"), eq(reminders.scopeId, id)));
    
    // 6. Delete assets related to this property
    await db.delete(assets).where(eq(assets.propertyId, id));
    
    // 7. Finally delete the property itself
    await db.delete(properties).where(eq(properties.id, id));
  }

  // Unit operations
  async getAllUnits(orgId: string): Promise<Unit[]> {
    return await db
      .select({
        id: units.id,
        propertyId: units.propertyId,
        label: units.label,
        bedrooms: units.bedrooms,
        bathrooms: units.bathrooms,
        sqft: units.sqft,
        floor: units.floor,
        rentAmount: units.rentAmount,
        deposit: units.deposit,
        notes: units.notes,
        hvacBrand: units.hvacBrand,
        hvacModel: units.hvacModel,
        hvacYear: units.hvacYear,
        hvacLifetime: units.hvacLifetime,
        hvacReminder: units.hvacReminder,
        waterHeaterBrand: units.waterHeaterBrand,
        waterHeaterModel: units.waterHeaterModel,
        waterHeaterYear: units.waterHeaterYear,
        waterHeaterLifetime: units.waterHeaterLifetime,
        waterHeaterReminder: units.waterHeaterReminder,
        applianceNotes: units.applianceNotes,
        createdAt: units.createdAt,
      })
      .from(units)
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(eq(properties.orgId, orgId))
      .orderBy(asc(units.label));
  }

  async getUnits(propertyId: string): Promise<Unit[]> {
    return await db
      .select()
      .from(units)
      .where(eq(units.propertyId, propertyId))
      .orderBy(asc(units.label));
  }

  async getUnit(id: string): Promise<Unit | undefined> {
    const [unit] = await db.select().from(units).where(eq(units.id, id));
    return unit;
  }

  async createUnit(unit: InsertUnit): Promise<Unit> {
    const insertData = {
      ...unit,
      bathrooms: typeof unit.bathrooms === 'number' ? String(unit.bathrooms) : unit.bathrooms,
    };
    const [newUnit] = await db.insert(units).values(insertData).returning();
    return newUnit;
  }

  async updateUnit(id: string, unit: Partial<InsertUnit>): Promise<Unit> {
    const updateData = {
      ...unit,
      bathrooms: typeof unit.bathrooms === 'number' ? String(unit.bathrooms) : unit.bathrooms,
    };
    const [updated] = await db
      .update(units)
      .set(updateData)
      .where(eq(units.id, id))
      .returning();
    return updated;
  }

  async deleteUnit(id: string): Promise<void> {
    await db.delete(units).where(eq(units.id, id));
  }


  // Unit appliance operations
  async createUnitAppliance(appliance: {
    unitId: string;
    name: string;
    manufacturer?: string;
    model?: string;
    year?: number;
    expectedLifetime?: number;
    alertBeforeExpiry?: number;
    notes?: string;
  }): Promise<any> {
    const [newAppliance] = await db.insert(unitAppliances).values(appliance).returning();
    return newAppliance;
  }

  async getUnitAppliances(unitId: string): Promise<any[]> {
    return await db.select().from(unitAppliances).where(eq(unitAppliances.unitId, unitId));
  }

  async deleteUnitAppliances(unitId: string): Promise<void> {
    await db.delete(unitAppliances).where(eq(unitAppliances.unitId, unitId));
  }

  // Tenant operations
  async getTenantGroups(orgId: string): Promise<TenantGroup[]> {
    return await db
      .select()
      .from(tenantGroups)
      .where(eq(tenantGroups.orgId, orgId))
      .orderBy(desc(tenantGroups.createdAt));
  }

  async getTenantGroup(id: string): Promise<TenantGroup | undefined> {
    const [group] = await db.select().from(tenantGroups).where(eq(tenantGroups.id, id));
    return group;
  }

  async createTenantGroup(group: InsertTenantGroup): Promise<TenantGroup> {
    const [newGroup] = await db.insert(tenantGroups).values(group).returning();
    return newGroup;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    return newTenant;
  }

  async updateTenantGroup(id: string, updates: Partial<InsertTenantGroup>): Promise<TenantGroup> {
    const [updated] = await db
      .update(tenantGroups)
      .set(updates)
      .where(eq(tenantGroups.id, id))
      .returning();
    return updated;
  }

  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant> {
    const [updated] = await db
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, id))
      .returning();
    return updated;
  }

  async archiveTenantGroup(id: string): Promise<TenantGroup> {
    // Archive the tenant group
    const [updated] = await db
      .update(tenantGroups)
      .set({ status: "Archived" })
      .where(eq(tenantGroups.id, id))
      .returning();
    
    // Automatically terminate associated leases
    await this.terminateLeasesByTenantGroup(id);
    
    return updated;
  }

  async deleteTenant(id: string): Promise<void> {
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async deleteTenantGroup(id: string): Promise<void> {
    // First delete all tenants in the group
    await db.delete(tenants).where(eq(tenants.groupId, id));
    // Then delete the group itself
    await db.delete(tenantGroups).where(eq(tenantGroups.id, id));
  }

  async getTenantsInGroup(groupId: string): Promise<Tenant[]> {
    return await db
      .select()
      .from(tenants)
      .where(eq(tenants.groupId, groupId));
  }

  async archiveTenant(id: string): Promise<Tenant> {
    // Archive the individual tenant
    const [updated] = await db
      .update(tenants)
      .set({ status: "Archived" })
      .where(eq(tenants.id, id))
      .returning();
    
    // Check if all tenants in the group are now archived (only if groupId exists)
    if (updated.groupId) {
      const allTenantsInGroup = await this.getTenantsInGroup(updated.groupId);
      const allArchived = allTenantsInGroup.every(tenant => tenant.status === "Archived");
      
      // If all tenants in the group are archived, terminate the leases
      if (allArchived) {
        await this.terminateLeasesByTenantGroup(updated.groupId);
      }
    }
    
    return updated;
  }

  async unarchiveTenant(id: string): Promise<Tenant> {
    // Unarchive the individual tenant
    const [updated] = await db
      .update(tenants)
      .set({ status: "Active" })
      .where(eq(tenants.id, id))
      .returning();
    
    // Note: We don't automatically reactivate leases when unarchiving tenants
    // This is intentional - reactivating leases requires more complex logic
    // and business rules that should be handled manually or through a separate workflow
    
    return updated;
  }

  // Add unarchive function for tenant groups  
  async unarchiveTenantGroup(id: string): Promise<TenantGroup> {
    // Unarchive the tenant group
    const [updated] = await db
      .update(tenantGroups)
      .set({ status: "Active" })
      .where(eq(tenantGroups.id, id))
      .returning();
    
    // Note: We don't automatically reactivate leases when unarchiving tenant groups
    // This is intentional - lease reactivation requires manual review of dates, rent, etc.
    
    return updated;
  }

  async permanentDeleteTenant(id: string): Promise<void> {
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  // Lease operations
  async getLeases(orgId: string): Promise<Lease[]> {
    const result = await db
      .select({
        id: leases.id,
        unitId: leases.unitId,
        tenantGroupId: leases.tenantGroupId,
        startDate: leases.startDate,
        endDate: leases.endDate,
        rent: leases.rent,
        deposit: leases.deposit,
        dueDay: leases.dueDay,
        lateFeeRuleJson: leases.lateFeeRuleJson,
        status: leases.status,
        createdAt: leases.createdAt,
        // New renewal and reminder fields
        autoRenewEnabled: leases.autoRenewEnabled,
        expirationReminderMonths: leases.expirationReminderMonths,
        renewalReminderEnabled: leases.renewalReminderEnabled,
      })
      .from(leases)
      .leftJoin(units, eq(leases.unitId, units.id))
      .leftJoin(properties, eq(units.propertyId, properties.id))
      .where(eq(properties.orgId, orgId))
      .orderBy(desc(leases.startDate));
    return result;
  }

  async getLease(id: string): Promise<Lease | undefined> {
    const [lease] = await db.select().from(leases).where(eq(leases.id, id));
    return lease;
  }

  async getLeasesByTenantGroup(tenantGroupId: string): Promise<Lease[]> {
    return await db
      .select()
      .from(leases)
      .where(eq(leases.tenantGroupId, tenantGroupId))
      .orderBy(desc(leases.startDate));
  }

  // Helper function to cancel recurring rent revenue for a specific lease
  async cancelLeaseRecurringRevenue(leaseId: string): Promise<void> {
    try {
      // Get the lease details to identify related transactions
      const lease = await this.getLease(leaseId);
      if (!lease) {
        console.warn(`⚠️ Lease ${leaseId} not found when trying to cancel recurring revenue`);
        return;
      }

      // Find recurring rent transactions for this lease (by unitId and type)
      // Rent revenue transactions are created with:
      // - type: "Income", category: "Rental Income", unitId: lease.unitId
      // - isRecurring: true, notes containing lease ID
      const recurringRentTransactions = await db
        .select()
        .from(transactions)
        .where(and(
          eq(transactions.unitId, lease.unitId),
          eq(transactions.type, "Income"),
          eq(transactions.category, "Rental Income"),
          eq(transactions.isRecurring, true),
          like(transactions.notes, `%lease ${leaseId}%`)
        ));

      if (recurringRentTransactions.length === 0) {
        console.log(`📊 No recurring rent revenue found for lease ${leaseId}`);
        return;
      }

      const currentDate = new Date();
      let canceledCount = 0;

      for (const transaction of recurringRentTransactions) {
        // End the recurring transaction by setting recurringEndDate to yesterday
        // This prevents future instances from being generated
        const endDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
        
        await db
          .update(transactions)
          .set({ 
            recurringEndDate: endDate,
            notes: `${transaction.notes || ""} [TERMINATED: Lease ended on ${currentDate.toDateString()}]`
          })
          .where(eq(transactions.id, transaction.id));

        // Cancel future pending rent payments (transactions with dates >= today)
        await db
          .delete(transactions)
          .where(and(
            eq(transactions.parentRecurringId, transaction.id),
            gte(transactions.date, currentDate),
            eq(transactions.paymentStatus, "Unpaid")
          ));

        canceledCount++;
        console.log(`💰 Canceled recurring rent revenue for lease ${leaseId}: $${transaction.amount}/month`);
      }

      console.log(`✅ Successfully canceled ${canceledCount} recurring rent revenue stream(s) for lease ${leaseId}`);
      
    } catch (error) {
      console.error(`❌ Error canceling recurring revenue for lease ${leaseId}:`, error);
    }
  }

  // Helper function to cancel lease-related reminders
  async cancelLeaseReminders(leaseId: string): Promise<void> {
    try {
      // Find all reminders scoped to this lease
      const leaseReminders = await db
        .select()
        .from(reminders)
        .where(and(
          eq(reminders.scope, "lease"),
          eq(reminders.scopeId, leaseId),
          eq(reminders.status, "Pending") // Only cancel pending reminders
        ));

      if (leaseReminders.length === 0) {
        console.log(`🔔 No pending reminders found for lease ${leaseId}`);
        return;
      }

      // Cancel all pending lease reminders
      await db
        .update(reminders)
        .set({ 
          status: "Completed",
          completedAt: new Date()
        })
        .where(and(
          eq(reminders.scope, "lease"),
          eq(reminders.scopeId, leaseId),
          eq(reminders.status, "Pending")
        ));

      console.log(`✅ Canceled ${leaseReminders.length} pending reminder(s) for lease ${leaseId}`);
      
    } catch (error) {
      console.error(`❌ Error canceling reminders for lease ${leaseId}:`, error);
    }
  }

  // Terminate all leases associated with a tenant group with comprehensive financial cleanup
  async terminateLeasesByTenantGroup(tenantGroupId: string): Promise<void> {
    // Get all active leases for this tenant group
    const activeLeases = await db
      .select()
      .from(leases)
      .where(and(
        eq(leases.tenantGroupId, tenantGroupId),
        eq(leases.status, "Active")
      ));

    // Terminate each active lease with full financial cleanup
    if (activeLeases.length > 0) {
      console.log(`🏠 Automatically terminating ${activeLeases.length} lease(s) for archived tenant group ${tenantGroupId}`);
      
      const terminationDate = new Date();
      
      for (const lease of activeLeases) {
        console.log(`🔄 Processing lease termination: ${lease.id}`);
        
        // 1. Cancel recurring rent revenue
        await this.cancelLeaseRecurringRevenue(lease.id);
        
        // 2. Cancel lease reminders
        await this.cancelLeaseReminders(lease.id);
        
        // 3. Update lease status and set proper end date
        await db
          .update(leases)
          .set({ 
            status: "Terminated",
            // Set end date to current date if lease was supposed to run longer
            endDate: terminationDate < new Date(lease.endDate) ? terminationDate : new Date(lease.endDate)
          })
          .where(eq(leases.id, lease.id));
        
        console.log(`✅ Lease ${lease.id} fully terminated with financial cleanup`);
      }
      
      console.log(`🎯 Successfully terminated ${activeLeases.length} lease(s) with complete financial side-effects cleanup`);
    } else {
      console.log(`ℹ️ No active leases found for tenant group ${tenantGroupId}`);
    }
  }

  async getActiveLease(unitId: string): Promise<Lease | undefined> {
    const [lease] = await db
      .select()
      .from(leases)
      .where(and(eq(leases.unitId, unitId), eq(leases.status, "Active")))
      .limit(1);
    return lease;
  }

  async createLease(lease: InsertLease): Promise<Lease> {
    const [newLease] = await db.insert(leases).values(lease).returning();
    return newLease;
  }

  async updateLease(id: string, lease: Partial<InsertLease>): Promise<Lease> {
    const [updated] = await db
      .update(leases)
      .set(lease)
      .where(eq(leases.id, id))
      .returning();
    return updated;
  }

  // Smart Case operations
  async getSmartCases(orgId: string): Promise<SmartCase[]> {
    return await db
      .select()
      .from(smartCases)
      .where(eq(smartCases.orgId, orgId))
      .orderBy(desc(smartCases.createdAt));
  }

  async getSmartCase(id: string): Promise<SmartCase | undefined> {
    const [smartCase] = await db.select().from(smartCases).where(eq(smartCases.id, id));
    return smartCase;
  }

  async createSmartCase(smartCase: InsertSmartCase): Promise<SmartCase> {
    const [newCase] = await db.insert(smartCases).values(smartCase).returning();
    return newCase;
  }

  async updateSmartCase(id: string, smartCase: Partial<InsertSmartCase>): Promise<SmartCase> {
    const [updated] = await db
      .update(smartCases)
      .set({ ...smartCase, updatedAt: new Date() })
      .where(eq(smartCases.id, id))
      .returning();
    return updated;
  }

  async deleteSmartCase(id: string): Promise<void> {
    // First get all scheduled jobs for this case
    const relatedJobs = await db
      .select({ id: scheduledJobs.id })
      .from(scheduledJobs)
      .where(eq(scheduledJobs.caseId, id));
    
    const jobIds = relatedJobs.map(job => job.id);
    
    // Delete counter-proposals for those scheduled jobs
    if (jobIds.length > 0) {
      for (const jobId of jobIds) {
        await db.delete(counterProposals).where(eq(counterProposals.scheduledJobId, jobId));
      }
    }
    
    // Delete all related records to avoid foreign key constraint violations
    await db.delete(scheduledJobs).where(eq(scheduledJobs.caseId, id));
    await db.delete(appointmentProposals).where(eq(appointmentProposals.caseId, id));
    await db.delete(appointments).where(eq(appointments.caseId, id));
    await db.delete(caseMedia).where(eq(caseMedia.caseId, id));
    await db.delete(caseEvents).where(eq(caseEvents.caseId, id));
    
    // Finally delete the case itself
    await db.delete(smartCases).where(eq(smartCases.id, id));
  }

  // Asset operations
  async getAssets(propertyId?: string, unitId?: string): Promise<Asset[]> {
    const baseQuery = db.select().from(assets);
    
    if (propertyId && unitId) {
      return await baseQuery
        .where(and(eq(assets.propertyId, propertyId), eq(assets.unitId, unitId)))
        .orderBy(asc(assets.category));
    } else if (propertyId) {
      return await baseQuery
        .where(eq(assets.propertyId, propertyId))
        .orderBy(asc(assets.category));
    } else if (unitId) {
      return await baseQuery
        .where(eq(assets.unitId, unitId))
        .orderBy(asc(assets.category));
    }
    
    return await baseQuery.orderBy(asc(assets.category));
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [newAsset] = await db.insert(assets).values(asset).returning();
    return newAsset;
  }

  // Vendor operations
  async getVendors(orgId: string): Promise<Vendor[]> {
    return await db
      .select()
      .from(vendors)
      .where(eq(vendors.orgId, orgId))
      .orderBy(asc(vendors.name));
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  // Transaction operations
  async getTransactions(orgId: string, type?: "Income" | "Expense"): Promise<Transaction[]> {
    if (type) {
      return await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.orgId, orgId), eq(transactions.type, type)))
        .orderBy(desc(transactions.date));
    }
    
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.orgId, orgId))
      .orderBy(desc(transactions.date));
  }

  async getTransactionById(id: string): Promise<Transaction | undefined> {
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);
    
    return result[0];
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  async updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction> {
    const [updated] = await db
      .update(transactions)
      .set(transaction)
      .where(eq(transactions.id, id))
      .returning();
    return updated;
  }

  async deleteTransaction(id: string): Promise<void> {
    // First delete any line items associated with this transaction
    await db.delete(transactionLineItems).where(eq(transactionLineItems.transactionId, id));
    
    // Then delete the transaction itself
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async deleteRecurringTransaction(id: string, mode: "future" | "all"): Promise<void> {
    // Get the transaction to determine its recurring relationship
    const transaction = await this.getTransactionById(id);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // If this is not a recurring transaction, just delete it normally
    if (!transaction.isRecurring && !transaction.parentRecurringId) {
      await this.deleteTransaction(id);
      return;
    }

    const currentDate = new Date(transaction.date);

    if (transaction.isRecurring && !transaction.parentRecurringId) {
      // Case 1: This is the original recurring transaction (parent)
      if (mode === "all") {
        // Delete the parent and all children
        
        // First, delete line items for the parent
        await db.delete(transactionLineItems).where(eq(transactionLineItems.transactionId, id));
        
        // Delete line items for all child transactions
        const childTransactionIds = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.parentRecurringId, id));
        
        if (childTransactionIds.length > 0) {
          await db.delete(transactionLineItems).where(
            or(...childTransactionIds.map(child => eq(transactionLineItems.transactionId, child.id)))
          );
        }
        
        // Delete all child transactions
        await db.delete(transactions).where(eq(transactions.parentRecurringId, id));
        
        // Delete the parent transaction itself
        await db.delete(transactions).where(eq(transactions.id, id));
      } else {
        // mode === "future": Delete the parent and all children from current date onwards
        
        // First, delete line items for the parent
        await db.delete(transactionLineItems).where(eq(transactionLineItems.transactionId, id));
        
        // Delete line items for future child transactions only
        const futureChildTransactionIds = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(and(
            eq(transactions.parentRecurringId, id),
            gte(transactions.date, currentDate)
          ));
        
        if (futureChildTransactionIds.length > 0) {
          await db.delete(transactionLineItems).where(
            or(...futureChildTransactionIds.map(child => eq(transactionLineItems.transactionId, child.id)))
          );
        }
        
        // Delete future child transactions only
        await db.delete(transactions).where(and(
          eq(transactions.parentRecurringId, id),
          gte(transactions.date, currentDate)
        ));
        
        // Delete the parent transaction itself
        await db.delete(transactions).where(eq(transactions.id, id));
      }
      
    } else if (transaction.parentRecurringId) {
      // Case 2: This is a child recurring transaction
      const parentRecurringId = transaction.parentRecurringId;
      
      if (mode === "all") {
        // Delete all instances (parent and all children)
        
        // Delete line items for parent
        await db.delete(transactionLineItems).where(eq(transactionLineItems.transactionId, parentRecurringId));
        
        // Delete line items for all child transactions
        const allChildTransactionIds = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.parentRecurringId, parentRecurringId));
        
        if (allChildTransactionIds.length > 0) {
          await db.delete(transactionLineItems).where(
            or(...allChildTransactionIds.map(t => eq(transactionLineItems.transactionId, t.id)))
          );
        }
        
        // Delete all child transactions
        await db.delete(transactions).where(eq(transactions.parentRecurringId, parentRecurringId));
        
        // Delete the parent transaction
        await db.delete(transactions).where(eq(transactions.id, parentRecurringId));
      } else {
        // mode === "future": Delete this child and all future children, update parent's end date
        
        // Delete line items for this transaction and all future ones
        const futureTransactionIds = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.parentRecurringId, parentRecurringId),
              gte(transactions.date, currentDate)
            )
          );
        
        if (futureTransactionIds.length > 0) {
          await db.delete(transactionLineItems).where(
            or(...futureTransactionIds.map(t => eq(transactionLineItems.transactionId, t.id)))
          );
        }
        
        // Delete this transaction and all future recurring instances
        await db.delete(transactions).where(
          and(
            eq(transactions.parentRecurringId, parentRecurringId),
            gte(transactions.date, currentDate)
          )
        );
        
        // Update the parent's recurring end date to the day before this transaction
        const previousDay = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
        await db
          .update(transactions)
          .set({ 
            recurringEndDate: previousDay
          })
          .where(eq(transactions.id, parentRecurringId));
      }
    }
  }

  async updateRecurringTransaction(id: string, updateData: Partial<InsertTransaction>, mode: "future" | "all"): Promise<void> {
    // Get the transaction to determine its recurring relationship
    const transaction = await this.getTransactionById(id);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // If this is not a recurring transaction, just update it normally
    if (!transaction.isRecurring && !transaction.parentRecurringId) {
      await this.updateTransaction(id, updateData);
      return;
    }

    const currentDate = new Date(transaction.date);

    if (transaction.isRecurring && !transaction.parentRecurringId) {
      // Case 1: This is the original recurring transaction (parent)
      if (mode === "all") {
        // Update the parent and all children
        await db
          .update(transactions)
          .set(updateData)
          .where(eq(transactions.id, id));
        
        await db
          .update(transactions)
          .set(updateData)
          .where(eq(transactions.parentRecurringId, id));
      } else {
        // mode === "future": Update the parent and all future children
        
        // Update the parent transaction
        await db
          .update(transactions)
          .set(updateData)
          .where(eq(transactions.id, id));
        
        // Update all future child transactions (from current date onwards)
        await db
          .update(transactions)
          .set(updateData)
          .where(
            and(
              eq(transactions.parentRecurringId, id),
              gte(transactions.date, currentDate)
            )
          );
      }
      
    } else if (transaction.parentRecurringId) {
      // Case 2: This is a child recurring transaction
      const parentRecurringId = transaction.parentRecurringId;
      
      if (mode === "all") {
        // Update the parent and all children
        await db
          .update(transactions)
          .set(updateData)
          .where(eq(transactions.id, parentRecurringId));
        
        await db
          .update(transactions)
          .set(updateData)
          .where(eq(transactions.parentRecurringId, parentRecurringId));
      } else {
        // mode === "future": Update this child and all future children
        
        // Update this transaction and all future recurring instances
        await db
          .update(transactions)
          .set(updateData)
          .where(
            and(
              eq(transactions.parentRecurringId, parentRecurringId),
              gte(transactions.date, currentDate)
            )
          );
      }
    }
  }

  async updateTransactionPaymentStatus(id: string, paymentStatus: string, paidAmount?: number): Promise<void> {
    const updateData: any = { paymentStatus };
    if (paidAmount !== undefined) {
      updateData.paidAmount = paidAmount;
    }
    
    await db
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id));
  }

  async createExpense(expense: InsertExpense): Promise<Transaction> {
    const [newExpense] = await db.insert(transactions).values({
      ...expense,
      recurringEndDate: expense.recurringEndDate ? (typeof expense.recurringEndDate === 'string' ? new Date(expense.recurringEndDate) : expense.recurringEndDate) : null,
    }).returning();
    
    // If this is a recurring expense, create future instances
    if (expense.isRecurring && expense.recurringFrequency) {
      await this.createRecurringTransactions(newExpense);
    }
    
    // Create line items if provided
    if (expense.lineItems && expense.lineItems.length > 0) {
      const lineItems = expense.lineItems.map(item => ({
        ...item,
        transactionId: newExpense.id,
      }));
      await db.insert(transactionLineItems).values(lineItems);
    }

    return newExpense;
  }

  async createRevenue(revenue: InsertTransaction): Promise<Transaction> {
    const [newRevenue] = await db.insert(transactions).values({
      ...revenue,
      recurringEndDate: revenue.recurringEndDate ? (typeof revenue.recurringEndDate === 'string' ? new Date(revenue.recurringEndDate) : revenue.recurringEndDate) : null,
    }).returning();
    
    // If this is a recurring revenue, create future instances
    if (revenue.isRecurring && revenue.recurringFrequency) {
      await this.createRecurringTransactions(newRevenue);
    }

    return newRevenue;
  }

  async getTransactionsByEntity(entityId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.entityId, entityId))
      .orderBy(desc(transactions.date));
  }

  async getTransactionsByProperty(propertyId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.propertyId, propertyId))
      .orderBy(desc(transactions.date));
  }

  async getTransactionLineItems(transactionId: string): Promise<TransactionLineItem[]> {
    return await db
      .select()
      .from(transactionLineItems)
      .where(eq(transactionLineItems.transactionId, transactionId));
  }

  private async createRecurringTransactions(originalTransaction: Transaction): Promise<void> {
    if (!originalTransaction.isRecurring || !originalTransaction.recurringFrequency) return;

    const frequency = originalTransaction.recurringFrequency;
    const interval = originalTransaction.recurringInterval || 1;
    const startDate = new Date(originalTransaction.date);
    const endDate = originalTransaction.recurringEndDate ? new Date(originalTransaction.recurringEndDate) : null;
    
    // Calculate how many instances to create (limit to 24 months for safety)
    const maxInstances = 24;
    let currentDate = new Date(startDate);
    const instances: Array<any> = [];

    for (let i = 0; i < maxInstances; i++) {
      // Calculate next occurrence based on frequency and interval
      switch (frequency) {
        case "days":
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case "weeks":
          currentDate.setDate(currentDate.getDate() + (interval * 7));
          break;
        case "months":
          currentDate.setMonth(currentDate.getMonth() + interval);
          break;
        case "years":
          currentDate.setFullYear(currentDate.getFullYear() + interval);
          break;
        // Legacy support for old format
        case "monthly":
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case "quarterly":
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;
        case "biannually":
          currentDate.setMonth(currentDate.getMonth() + 6);
          break;
        case "annually":
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
      }

      // Stop if we've reached the end date
      if (endDate && currentDate > endDate) break;

      // Stop if we're more than 2 years out
      if (currentDate > new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)) break;

      // Generate clear month/year description for rent transactions  
      let instanceDescription = originalTransaction.description;
      if (originalTransaction.category === "Rental Income" && originalTransaction.description.includes(" Rent")) {
        const monthNames = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"];
        const instanceMonth = monthNames[currentDate.getMonth()];
        const instanceYear = currentDate.getFullYear();
        instanceDescription = `${instanceMonth} ${instanceYear} Rent`;
      }

      instances.push({
        orgId: originalTransaction.orgId,
        propertyId: originalTransaction.propertyId || undefined,
        unitId: originalTransaction.unitId || undefined,
        entityId: originalTransaction.entityId || undefined,
        vendorId: originalTransaction.vendorId || undefined,
        type: originalTransaction.type, // Use the original transaction type (Expense or Income)
        scope: (originalTransaction.scope as "property" | "operational") || "property",
        amount: originalTransaction.amount,
        description: instanceDescription,
        category: originalTransaction.category || undefined,
        date: new Date(currentDate),
        receiptUrl: originalTransaction.receiptUrl || undefined,
        notes: originalTransaction.notes || undefined,
        isRecurring: false, // Future instances are not recurring themselves
        recurringFrequency: undefined,
        recurringInterval: 1,
        recurringEndDate: null,
        taxDeductible: originalTransaction.taxDeductible || true,
        parentRecurringId: originalTransaction.id,
        isBulkEntry: false,
      });
    }

    // Insert all future instances
    if (instances.length > 0) {
      await db.insert(transactions).values(instances);
    }
  }

  // Reminder operations
  async getReminders(orgId: string): Promise<Reminder[]> {
    const results = await db
      .select({
        id: reminders.id,
        orgId: reminders.orgId,
        scope: reminders.scope,
        scopeId: reminders.scopeId,
        entityId: reminders.entityId,
        title: reminders.title,
        type: reminders.type,
        dueAt: reminders.dueAt,
        leadDays: reminders.leadDays,
        channels: reminders.channels,
        payloadJson: reminders.payloadJson,
        status: reminders.status,
        sentAt: reminders.sentAt,
        completedAt: reminders.completedAt,
        isRecurring: reminders.isRecurring,
        recurringFrequency: reminders.recurringFrequency,
        recurringInterval: reminders.recurringInterval,
        recurringEndDate: reminders.recurringEndDate,
        parentRecurringId: reminders.parentRecurringId,
        isBulkEntry: reminders.isBulkEntry,
        createdAt: reminders.createdAt,
      })
      .from(reminders)
      .where(eq(reminders.orgId, orgId))
      .orderBy(asc(reminders.dueAt));
    return results as Reminder[];
  }

  async getDueReminders(): Promise<Reminder[]> {
    const now = new Date();
    return await db
      .select()
      .from(reminders)
      .where(
        and(
          lte(reminders.dueAt, now),
          eq(reminders.status, "Pending")
        )
      );
  }

  async createReminder(reminder: InsertReminder): Promise<Reminder> {
    const [newReminder] = await db.insert(reminders).values({
      ...reminder,
      recurringEndDate: reminder.recurringEndDate ? (typeof reminder.recurringEndDate === 'string' ? new Date(reminder.recurringEndDate) : reminder.recurringEndDate) : null,
    }).returning();
    
    // If this is a recurring reminder, create future instances
    if (reminder.isRecurring && reminder.recurringFrequency) {
      await this.createRecurringReminders(newReminder);
    }
    
    return newReminder;
  }

  async updateReminder(id: string, reminder: Partial<InsertReminder>): Promise<Reminder> {
    const [updated] = await db
      .update(reminders)
      .set(reminder)
      .where(eq(reminders.id, id))
      .returning();
    return updated;
  }

  async deleteReminder(id: string): Promise<void> {
    await db.delete(reminders).where(eq(reminders.id, id));
  }

  async deleteRecurringReminder(id: string, mode: "future" | "all"): Promise<void> {
    // Get the reminder to determine its recurring relationship
    const [reminder] = await db.select().from(reminders).where(eq(reminders.id, id));
    if (!reminder) {
      throw new Error("Reminder not found");
    }

    // If this is not a recurring reminder, just delete it normally
    if (!reminder.isRecurring && !reminder.parentRecurringId) {
      await this.deleteReminder(id);
      return;
    }

    const currentDate = new Date(reminder.dueAt);

    if (reminder.isRecurring && !reminder.parentRecurringId) {
      // Case 1: This is the original recurring reminder (parent)
      if (mode === "all") {
        // Delete the parent and all children
        await db.delete(reminders).where(eq(reminders.parentRecurringId, id));
        await db.delete(reminders).where(eq(reminders.id, id));
      } else {
        // mode === "future": Delete from current date onwards
        await db.delete(reminders).where(
          and(
            eq(reminders.parentRecurringId, id),
            gte(reminders.dueAt, currentDate)
          )
        );
        // Update the parent's recurring end date to the day before this reminder
        const previousDay = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
        await db
          .update(reminders)
          .set({ recurringEndDate: previousDay })
          .where(eq(reminders.id, id));
      }
    } else if (reminder.parentRecurringId) {
      // Case 2: This is a child recurring reminder
      const parentRecurringId = reminder.parentRecurringId;
      
      if (mode === "all") {
        // Delete the entire series (parent and all children)
        await db.delete(reminders).where(eq(reminders.parentRecurringId, parentRecurringId));
        await db.delete(reminders).where(eq(reminders.id, parentRecurringId));
      } else {
        // mode === "future": Delete this reminder and all future recurring instances
        await db.delete(reminders).where(
          and(
            eq(reminders.parentRecurringId, parentRecurringId),
            gte(reminders.dueAt, currentDate)
          )
        );
        // Update the parent's recurring end date to the day before this reminder
        const previousDay = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
        await db
          .update(reminders)
          .set({ recurringEndDate: previousDay })
          .where(eq(reminders.id, parentRecurringId));
      }
    }
  }

  async updateRecurringReminder(id: string, data: Partial<InsertReminder>, mode: "future" | "all"): Promise<Reminder> {
    // Get the reminder to determine its recurring relationship
    const [reminder] = await db.select().from(reminders).where(eq(reminders.id, id));
    if (!reminder) {
      throw new Error("Reminder not found");
    }

    // If this is not a recurring reminder, just update it normally
    if (!reminder.isRecurring && !reminder.parentRecurringId) {
      return await this.updateReminder(id, data);
    }

    const currentDate = new Date(reminder.dueAt);
    let updatedReminder: Reminder;

    if (reminder.isRecurring && !reminder.parentRecurringId) {
      // Case 1: This is the original recurring reminder (parent)
      if (mode === "all") {
        // Update the parent and all children
        const [updated] = await db
          .update(reminders)
          .set(data)
          .where(eq(reminders.id, id))
          .returning();
        updatedReminder = updated;
        
        await db
          .update(reminders)
          .set(data)
          .where(eq(reminders.parentRecurringId, id));
      } else {
        // mode === "future": Update the parent and all future children
        const [updated] = await db
          .update(reminders)
          .set(data)
          .where(eq(reminders.id, id))
          .returning();
        updatedReminder = updated;
        
        await db
          .update(reminders)
          .set(data)
          .where(
            and(
              eq(reminders.parentRecurringId, id),
              gte(reminders.dueAt, currentDate)
            )
          );
      }
    } else if (reminder.parentRecurringId) {
      // Case 2: This is a child recurring reminder
      const parentRecurringId = reminder.parentRecurringId;
      
      if (mode === "all") {
        // Update the entire series (parent and all children)
        await db
          .update(reminders)
          .set(data)
          .where(eq(reminders.id, parentRecurringId));
          
        const [updated] = await db
          .update(reminders)
          .set(data)
          .where(eq(reminders.parentRecurringId, parentRecurringId))
          .returning();
        updatedReminder = Array.isArray(updated) && updated.length > 0 ? updated[0] : reminder;
      } else {
        // mode === "future": Update this reminder and all future recurring instances
        const [updated] = await db
          .update(reminders)
          .set(data)
          .where(
            and(
              eq(reminders.parentRecurringId, parentRecurringId),
              gte(reminders.dueAt, currentDate)
            )
          )
          .returning();
        updatedReminder = Array.isArray(updated) && updated.length > 0 ? updated[0] : reminder;
      }
    } else {
      updatedReminder = reminder;
    }

    return updatedReminder;
  }

  private async createRecurringReminders(originalReminder: Reminder): Promise<void> {
    if (!originalReminder.isRecurring || !originalReminder.recurringFrequency) return;

    const frequency = originalReminder.recurringFrequency;
    const interval = originalReminder.recurringInterval || 1;
    const startDate = new Date(originalReminder.dueAt);
    const endDate = originalReminder.recurringEndDate ? new Date(originalReminder.recurringEndDate) : null;
    
    // Calculate how many instances to create (limit to 24 months for safety)
    const maxInstances = 24;
    let currentDate = new Date(startDate);
    const instances: Array<any> = [];

    for (let i = 0; i < maxInstances; i++) {
      // Calculate next occurrence based on frequency and interval
      switch (frequency) {
        case "days":
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case "weeks":
          currentDate.setDate(currentDate.getDate() + (interval * 7));
          break;
        case "months":
          currentDate.setMonth(currentDate.getMonth() + interval);
          break;
        case "years":
          currentDate.setFullYear(currentDate.getFullYear() + interval);
          break;
        // Legacy support for old format
        case "monthly":
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case "quarterly":
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;
        case "biannually":
          currentDate.setMonth(currentDate.getMonth() + 6);
          break;
        case "annually":
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
      }

      // Stop if we've reached the end date
      if (endDate && currentDate > endDate) break;

      // Stop if we're more than 2 years out
      if (currentDate > new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)) break;

      instances.push({
        orgId: originalReminder.orgId,
        scope: originalReminder.scope,
        scopeId: originalReminder.scopeId || undefined,
        entityId: originalReminder.entityId || undefined,
        title: originalReminder.title,
        type: originalReminder.type,
        dueAt: new Date(currentDate),
        leadDays: originalReminder.leadDays || 0,
        channels: originalReminder.channels || ["inapp"],
        payloadJson: originalReminder.payloadJson || undefined,
        status: "Pending" as const,
        isRecurring: false, // Future instances are not recurring themselves
        recurringFrequency: undefined,
        recurringInterval: 1,
        recurringEndDate: null,
        parentRecurringId: originalReminder.id,
        isBulkEntry: false,
      });
    }

    // Insert all future instances
    if (instances.length > 0) {
      await db.insert(reminders).values(instances);
    }
  }

  // Create lease end reminders (similar to entity renewal reminders)
  async createLeaseEndReminders(): Promise<void> {
    const now = new Date();
    const reminderIntervals = [120, 90, 60, 30]; // Days before lease end
    
    // Get all active leases
    const activeLeases = await db
      .select({
        id: leases.id,
        endDate: leases.endDate,
        rent: leases.rent,
        unitId: leases.unitId,
        tenantGroupId: leases.tenantGroupId,
        unitLabel: units.label,
        propertyName: properties.name,
        propertyId: properties.id,
        orgId: properties.orgId,
        tenantGroupName: tenantGroups.name,
      })
      .from(leases)
      .leftJoin(units, eq(leases.unitId, units.id))
      .leftJoin(properties, eq(units.propertyId, properties.id))
      .leftJoin(tenantGroups, eq(leases.tenantGroupId, tenantGroups.id))
      .where(eq(leases.status, "Active"));

    for (const lease of activeLeases) {
      if (!lease.endDate || !lease.orgId) continue;

      const endDate = new Date(lease.endDate);
      const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Create reminders for each interval if lease ends within that timeframe
      for (const intervalDays of reminderIntervals) {
        if (daysUntilEnd <= intervalDays && daysUntilEnd > 0) {
          // Check if reminder already exists
          const existingReminder = await db
            .select()
            .from(reminders)
            .where(
              and(
                eq(reminders.orgId, lease.orgId),
                eq(reminders.scope, "lease"),
                eq(reminders.scopeId, lease.id),
                eq(reminders.type, "lease"),
                eq(reminders.leadDays, intervalDays)
              )
            )
            .limit(1);

          if (existingReminder.length === 0) {
            // Calculate reminder due date
            const reminderDate = new Date(endDate);
            reminderDate.setDate(reminderDate.getDate() - intervalDays);

            const reminderData = {
              orgId: lease.orgId,
              scope: "lease" as const,
              scopeId: lease.id,
              title: `Lease Expiring - ${lease.propertyName} ${lease.unitLabel ? `(${lease.unitLabel})` : ''}`,
              type: "lease" as const,
              dueAt: reminderDate,
              leadDays: intervalDays,
              channel: "inapp" as const,
              status: "Pending" as const,
              isRecurring: false,
              recurringInterval: 1,
              isBulkEntry: false,
              payloadJson: {
                leaseId: lease.id,
                tenantGroup: lease.tenantGroupName,
                property: lease.propertyName,
                unit: lease.unitLabel,
                endDate: lease.endDate,
                rent: lease.rent,
              },
            };

            await this.createReminder(reminderData);
            console.log(`Created lease end reminder (${intervalDays} days) for: ${lease.propertyName} ${lease.unitLabel || ''}`);
          }
        }
      }
    }
  }

  // Consolidated compliance and recurring payment reminder generation
  async generateComplianceReminders(): Promise<void> {
    console.log('🔔 Generating compliance and recurring payment reminders...');
    const now = new Date();

    // Get all active properties with organization data
    const propertiesData = await db
      .select({
        id: properties.id,
        name: properties.name,
        orgId: properties.orgId,
        monthlyMortgage: properties.monthlyMortgage,
        mortgageStartDate: properties.mortgageStartDate,
        monthlyMortgage2: properties.monthlyMortgage2,
        mortgageStartDate2: properties.mortgageStartDate2,
        saleDate: properties.saleDate,
        insuranceExpiryDate: properties.insuranceExpiryDate,
        insuranceCarrier: properties.insuranceCarrier,
        propertyTaxDueMonth: properties.propertyTaxDueMonth,
        propertyTaxDueDay: properties.propertyTaxDueDay,
        hoaFeeAmount: properties.hoaFeeAmount,
        hoaFeeDueDay: properties.hoaFeeDueDay,
        hoaName: properties.hoaName,
      })
      .from(properties)
      .where(eq(properties.status, 'Active'));

    for (const property of propertiesData) {
      // 1. Generate mortgage payment reminders (monthly, 5 days before due on 1st)
      if (property.monthlyMortgage && property.mortgageStartDate && !property.saleDate) {
        const startDate = new Date(property.mortgageStartDate);
        if (startDate <= now) {
          await this.upsertMonthlyReminder({
            orgId: property.orgId,
            propertyId: property.id,
            propertyName: property.name,
            type: 'mortgage',
            title: `Mortgage Payment Due - ${property.name}`,
            dueDay: 1,
            leadDays: 5,
            amount: property.monthlyMortgage,
          });
        }
      }

      // 2. Generate second mortgage reminders if applicable
      if (property.monthlyMortgage2 && property.mortgageStartDate2 && !property.saleDate) {
        const startDate = new Date(property.mortgageStartDate2);
        if (startDate <= now) {
          await this.upsertMonthlyReminder({
            orgId: property.orgId,
            propertyId: property.id,
            propertyName: property.name,
            type: 'mortgage',
            title: `2nd Mortgage Payment Due - ${property.name}`,
            dueDay: 1,
            leadDays: 5,
            amount: property.monthlyMortgage2,
          });
        }
      }

      // 3. Generate insurance renewal reminders (90, 60, 30 days before expiry)
      if (property.insuranceExpiryDate) {
        const expiryDate = new Date(property.insuranceExpiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        for (const leadDays of [90, 60, 30]) {
          if (daysUntilExpiry <= leadDays && daysUntilExpiry > 0) {
            await this.upsertComplianceReminder({
              orgId: property.orgId,
              propertyId: property.id,
              propertyName: property.name,
              type: 'insurance',
              title: `Insurance Renewal Due (${leadDays} days) - ${property.name}`,
              dueDate: expiryDate,
              leadDays,
              metadata: {
                carrier: property.insuranceCarrier,
                expiryDate: property.insuranceExpiryDate,
              },
            });
          }
        }
      }

      // 4. Generate property tax reminders (60, 30, 7 days before due)
      if (property.propertyTaxDueMonth && property.propertyTaxDueDay) {
        const currentYear = now.getFullYear();
        const taxDueDate = new Date(currentYear, property.propertyTaxDueMonth - 1, property.propertyTaxDueDay);
        
        // If this year's tax date has passed, check next year
        if (taxDueDate < now) {
          taxDueDate.setFullYear(currentYear + 1);
        }
        
        const daysUntilDue = Math.ceil((taxDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        for (const leadDays of [60, 30, 7]) {
          if (daysUntilDue <= leadDays && daysUntilDue > 0) {
            await this.upsertComplianceReminder({
              orgId: property.orgId,
              propertyId: property.id,
              propertyName: property.name,
              type: 'property_tax',
              title: `Property Tax Due (${leadDays} days) - ${property.name}`,
              dueDate: taxDueDate,
              leadDays,
              metadata: {
                taxYear: taxDueDate.getFullYear(),
              },
            });
          }
        }
      }

      // 5. Generate HOA fee reminders (monthly, 5 days before due)
      if (property.hoaFeeAmount && property.hoaFeeDueDay && property.hoaName) {
        await this.upsertMonthlyReminder({
          orgId: property.orgId,
          propertyId: property.id,
          propertyName: property.name,
          type: 'hoa',
          title: `HOA Fee Due - ${property.name}`,
          dueDay: property.hoaFeeDueDay,
          leadDays: 5,
          amount: property.hoaFeeAmount,
        });
      }
    }

    // 6. Generate entity license/permit renewal reminders
    const entitiesData = await db
      .select({
        id: ownershipEntities.id,
        name: ownershipEntities.name,
        orgId: ownershipEntities.orgId,
        licenseRenewalDate: ownershipEntities.licenseRenewalDate,
        permitExpiryDate: ownershipEntities.permitExpiryDate,
      })
      .from(ownershipEntities)
      .where(eq(ownershipEntities.status, 'Active'));

    for (const entity of entitiesData) {
      // License renewal reminders (90, 60, 30 days before)
      if (entity.licenseRenewalDate) {
        const renewalDate = new Date(entity.licenseRenewalDate);
        const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        for (const leadDays of [90, 60, 30]) {
          if (daysUntilRenewal <= leadDays && daysUntilRenewal > 0) {
            await this.upsertEntityReminderByDate({
              orgId: entity.orgId,
              entityId: entity.id,
              entityName: entity.name,
              type: 'permit',
              title: `Business License Renewal (${leadDays} days) - ${entity.name}`,
              dueDate: renewalDate,
              leadDays,
            });
          }
        }
      }

      // Permit expiry reminders (90, 60, 30 days before)
      if (entity.permitExpiryDate) {
        const expiryDate = new Date(entity.permitExpiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        for (const leadDays of [90, 60, 30]) {
          if (daysUntilExpiry <= leadDays && daysUntilExpiry > 0) {
            await this.upsertEntityReminderByDate({
              orgId: entity.orgId,
              entityId: entity.id,
              entityName: entity.name,
              type: 'permit',
              title: `Operating Permit Renewal (${leadDays} days) - ${entity.name}`,
              dueDate: expiryDate,
              leadDays,
            });
          }
        }
      }
    }

    console.log('✅ Compliance reminder generation complete');
  }

  // Helper: Upsert monthly recurring reminder (idempotent)
  private async upsertMonthlyReminder(params: {
    orgId: string;
    propertyId: string;
    propertyName: string;
    type: 'rent' | 'mortgage' | 'property_tax' | 'hoa' | 'regulatory';
    title: string;
    dueDay: number;
    leadDays: number;
    amount?: any;
  }): Promise<void> {
    const { orgId, propertyId, propertyName, type, title, dueDay, leadDays, amount } = params;
    const now = new Date();
    
    // Calculate next due date
    const nextDueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (nextDueDate < now) {
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    }
    
    // Calculate reminder date (leadDays before due)
    const reminderDate = new Date(nextDueDate);
    reminderDate.setDate(reminderDate.getDate() - leadDays);

    // Check if reminder already exists for this property and month
    const existing = await db
      .select()
      .from(reminders)
      .where(
        and(
          eq(reminders.orgId, orgId),
          eq(reminders.scope, 'property'),
          eq(reminders.scopeId, propertyId),
          eq(reminders.type, type),
          eq(reminders.title, title),
          eq(reminders.leadDays, leadDays)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await this.createReminder({
        orgId,
        scope: 'property',
        scopeId: propertyId,
        title,
        type,
        dueAt: reminderDate,
        leadDays,
        channels: ['inapp'],
        status: 'Pending',
        isRecurring: false,
        recurringInterval: 1,
        isBulkEntry: false,
        payloadJson: {
          propertyName,
          dueDay,
          amount: amount ? amount.toString() : undefined,
        },
      });
      console.log(`  ✓ Created: ${title}`);
    }
  }

  // Helper: Upsert compliance reminder by specific date (idempotent)
  private async upsertComplianceReminder(params: {
    orgId: string;
    propertyId: string;
    propertyName: string;
    type: 'insurance' | 'property_tax' | 'regulatory';
    title: string;
    dueDate: Date;
    leadDays: number;
    metadata?: any;
  }): Promise<void> {
    const { orgId, propertyId, propertyName, type, title, dueDate, leadDays, metadata } = params;
    
    // Calculate reminder date
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - leadDays);

    // Check if reminder already exists
    const existing = await db
      .select()
      .from(reminders)
      .where(
        and(
          eq(reminders.orgId, orgId),
          eq(reminders.scope, 'property'),
          eq(reminders.scopeId, propertyId),
          eq(reminders.type, type),
          eq(reminders.title, title),
          eq(reminders.leadDays, leadDays)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await this.createReminder({
        orgId,
        scope: 'property',
        scopeId: propertyId,
        title,
        type,
        dueAt: reminderDate,
        leadDays,
        channels: ['inapp'],
        status: 'Pending',
        isRecurring: false,
        recurringInterval: 1,
        isBulkEntry: false,
        payloadJson: {
          propertyName,
          dueDate: dueDate.toISOString(),
          ...metadata,
        },
      });
      console.log(`  ✓ Created: ${title} (${leadDays} days lead)`);
    }
  }

  // Helper: Upsert entity reminder by specific date (idempotent)
  private async upsertEntityReminderByDate(params: {
    orgId: string;
    entityId: string;
    entityName: string;
    type: 'permit' | 'regulatory';
    title: string;
    dueDate: Date;
    leadDays: number;
  }): Promise<void> {
    const { orgId, entityId, entityName, type, title, dueDate, leadDays } = params;
    
    // Calculate reminder date
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - leadDays);

    // Check if reminder already exists
    const existing = await db
      .select()
      .from(reminders)
      .where(
        and(
          eq(reminders.orgId, orgId),
          eq(reminders.entityId, entityId),
          eq(reminders.type, type),
          eq(reminders.title, title),
          eq(reminders.leadDays, leadDays)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await this.createReminder({
        orgId,
        entityId,
        title,
        type,
        dueAt: reminderDate,
        leadDays,
        channels: ['inapp'],
        status: 'Pending',
        isRecurring: false,
        recurringInterval: 1,
        isBulkEntry: false,
        payloadJson: {
          entityName,
          dueDate: dueDate.toISOString(),
        },
      });
      console.log(`  ✓ Created: ${title} (${leadDays} days lead)`);
    }
  }

  // Notification operations
  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async createNotification(userId: string, title: string, message: string, type = "info", targetRole?: string, targetName?: string): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values({ userId, title, message, type, targetRole, targetName })
      .returning();
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  // Dashboard operations
  async getDashboardStats(orgId: string): Promise<{
    totalProperties: number;
    monthlyRevenue: number;
    openCases: number;
    dueReminders: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Total properties
    const [propertyCount] = await db
      .select({ count: count() })
      .from(properties)
      .where(eq(properties.orgId, orgId));

    // Monthly revenue (rent income for current month)
    const [monthlyRevenue] = await db
      .select({ 
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` 
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.orgId, orgId),
          eq(transactions.type, "Income"),
          gte(transactions.date, startOfMonth),
          lte(transactions.date, endOfMonth)
        )
      );

    // Open cases
    const [openCases] = await db
      .select({ count: count() })
      .from(smartCases)
      .where(
        and(
          eq(smartCases.orgId, orgId),
          sql`${smartCases.status} NOT IN ('Resolved', 'Closed')`
        )
      );

    // Due reminders
    const [dueReminders] = await db
      .select({ count: count() })
      .from(reminders)
      .where(
        and(
          eq(reminders.orgId, orgId),
          eq(reminders.status, "Pending"),
          lte(reminders.dueAt, now)
        )
      );

    return {
      totalProperties: propertyCount.count,
      monthlyRevenue: monthlyRevenue.total || 0,
      openCases: openCases.count,
      dueReminders: dueReminders.count,
    };
  }

  async getRentCollectionStatus(orgId: string): Promise<{
    collected: number;
    total: number;
    percentage: number;
    items: Array<{
      id: string;
      property: string;
      tenant: string;
      amount: number;
      status: "paid" | "due" | "overdue";
      dueDate: Date;
    }>;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all active leases with property and tenant info
    const activeLeases = await db
      .select({
        leaseId: leases.id,
        rent: leases.rent,
        dueDay: leases.dueDay,
        propertyName: properties.name,
        unitLabel: units.label,
        tenantGroupId: leases.tenantGroupId,
      })
      .from(leases)
      .leftJoin(units, eq(leases.unitId, units.id))
      .leftJoin(properties, eq(units.propertyId, properties.id))
      .leftJoin(tenantGroups, eq(leases.tenantGroupId, tenantGroups.id))
      .where(
        and(
          eq(properties.orgId, orgId),
          eq(leases.status, "Active")
        )
      );

    // Calculate totals and status
    let totalRent = 0;
    let collectedRent = 0;
    const items: Array<{
      id: string;
      property: string;
      tenant: string;
      amount: number;
      status: "paid" | "due" | "overdue";
      dueDate: Date;
    }> = [];

    for (const lease of activeLeases) {
      totalRent += Number(lease.rent);
      
      const dueDate = new Date(now.getFullYear(), now.getMonth(), lease.dueDay || 1);
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if rent has been paid this month
      const [payment] = await db
        .select({ total: sql<number>`SUM(${transactions.amount})` })
        .from(transactions)
        .where(
          and(
            eq(transactions.orgId, orgId),
            eq(transactions.type, "Income"),
            sql`${transactions.description} LIKE '%rent%'`,
            gte(transactions.date, startOfMonth),
            lte(transactions.date, endOfMonth)
          )
        );

      const isPaid = payment && Number(payment.total) >= Number(lease.rent);
      
      if (isPaid) {
        collectedRent += Number(lease.rent);
      }

      let status: "paid" | "due" | "overdue" = "due";
      if (isPaid) {
        status = "paid";
      } else if (daysPastDue > 0) {
        status = "overdue";
      }

      items.push({
        id: lease.leaseId,
        property: `${lease.propertyName} - ${lease.unitLabel}`,
        tenant: lease.tenantGroupId ? "Tenant Group" : "No Tenant",
        amount: Number(lease.rent),
        status,
        dueDate,
      });
    }

    const percentage = totalRent > 0 ? Math.round((collectedRent / totalRent) * 100) : 0;

    return {
      collected: collectedRent,
      total: totalRent,
      percentage,
      items,
    };
  }

  // Generate missing recurring transactions
  async generateRecurringTransactions(): Promise<void> {
    console.log("Generating missing recurring transactions...");
    
    // Find ALL recurring transactions (both Income and Expense)
    const recurringTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.isRecurring, true));

    console.log(`Found ${recurringTransactions.length} recurring transactions to process`);

    for (const recurringTransaction of recurringTransactions) {
      try {
        console.log(`Processing recurring ${recurringTransaction.type}: ${recurringTransaction.description} (${recurringTransaction.category})`);
        await this.generateMissingTransactionsForRecurring(recurringTransaction);
      } catch (error) {
        console.error(`Error generating recurring transactions for ${recurringTransaction.id}:`, error);
      }
    }
  }

  private async generateMissingTransactionsForRecurring(recurringTransaction: any): Promise<void> {
    const startDate = new Date(recurringTransaction.date);
    const now = new Date();
    const frequency = recurringTransaction.recurringFrequency;
    const interval = recurringTransaction.recurringInterval || 1;
    
    console.log(`  → Transaction: ${recurringTransaction.description}, Frequency: ${frequency}, Interval: ${interval}`);
    
    // Validate frequency to prevent infinite loops
    const validFrequencies = ["monthly", "quarterly", "annually", "weeks", "days", "months"];
    if (!validFrequencies.includes(frequency)) {
      console.log(`  → Skipping transaction with invalid frequency: ${frequency}`);
      return;
    }
    
    // Get end date if specified, otherwise use current date + 2 years max
    const maxEndDate = new Date(now);
    maxEndDate.setFullYear(maxEndDate.getFullYear() + 2); // Safety limit: 2 years max
    
    const endDate = recurringTransaction.recurringEndDate 
      ? new Date(recurringTransaction.recurringEndDate)
      : maxEndDate;

    // Generate expected transactions with safety limit
    const expectedDates: Date[] = [];
    let currentDate = new Date(startDate);
    let iterations = 0;
    const MAX_ITERATIONS = 100; // Safety limit to prevent infinite loops
    
    while (currentDate <= endDate && currentDate <= now && iterations < MAX_ITERATIONS) {
      expectedDates.push(new Date(currentDate));
      iterations++;
      
      const previousDate = new Date(currentDate);
      
      // Calculate next occurrence based on frequency
      if (frequency === "monthly" || frequency === "months") {
        currentDate.setMonth(currentDate.getMonth() + interval);
      } else if (frequency === "quarterly") {
        currentDate.setMonth(currentDate.getMonth() + (3 * interval));
      } else if (frequency === "annually") {
        currentDate.setFullYear(currentDate.getFullYear() + interval);
      } else if (frequency === "weeks") {
        currentDate.setDate(currentDate.getDate() + (7 * interval));
      } else if (frequency === "days") {
        currentDate.setDate(currentDate.getDate() + interval);
      }
      
      // Safety check: ensure date actually advanced
      if (currentDate.getTime() <= previousDate.getTime()) {
        console.error(`  → Date not advancing! Breaking loop to prevent infinite generation.`);
        break;
      }
    }
    
    if (iterations >= MAX_ITERATIONS) {
      console.warn(`  → Hit safety limit of ${MAX_ITERATIONS} iterations for ${recurringTransaction.description}`);
    }
    
    console.log(`  → Generated ${expectedDates.length} expected dates for processing`);

    // Check which transactions already exist
    const existingTransactions = await db
      .select({ date: transactions.date })
      .from(transactions)
      .where(
        and(
          eq(transactions.orgId, recurringTransaction.orgId),
          eq(transactions.propertyId, recurringTransaction.propertyId),
          eq(transactions.type, recurringTransaction.type), // Use actual type (Income or Expense)
          eq(transactions.category, recurringTransaction.category),
          eq(transactions.amount, recurringTransaction.amount),
          or(
            eq(transactions.parentRecurringId, recurringTransaction.id),
            eq(transactions.id, recurringTransaction.id) // Include the original transaction
          )
        )
      );

    const existingDateStrings = existingTransactions.map(t => 
      t.date.toISOString().split('T')[0]
    );

    // Create missing transactions
    for (const expectedDate of expectedDates) {
      const expectedDateString = expectedDate.toISOString().split('T')[0];
      
      if (!existingDateStrings.includes(expectedDateString)) {
        // Create missing transaction with appropriate defaults
        const isExpense = recurringTransaction.type === "Expense";
        
        await db.insert(transactions).values({
          orgId: recurringTransaction.orgId,
          propertyId: recurringTransaction.propertyId,
          unitId: recurringTransaction.unitId,
          entityId: recurringTransaction.entityId,
          type: recurringTransaction.type, // Use actual type (Income or Expense)
          scope: recurringTransaction.scope,
          amount: recurringTransaction.amount,
          description: `${recurringTransaction.description} (Auto-generated)`,
          category: recurringTransaction.category,
          date: expectedDate,
          notes: `Auto-generated from recurring ${recurringTransaction.type.toLowerCase()} rule`,
          taxDeductible: recurringTransaction.taxDeductible,
          parentRecurringId: recurringTransaction.id,
          paymentStatus: isExpense ? "Unpaid" : "Paid", // Expenses default to Unpaid, Income to Paid
        });

        console.log(`Generated missing ${recurringTransaction.type} for ${expectedDate.toISOString().split('T')[0]}: ${recurringTransaction.description}`);
      }
    }
  }

  // Contractor operations
  async getContractors(orgId: string): Promise<Vendor[]> {
    return db.select().from(vendors).where(
      and(
        eq(vendors.orgId, orgId),
        eq(vendors.isActiveContractor, true)
      )
    );
  }

  async getContractor(id: string): Promise<Vendor | undefined> {
    const [contractor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return contractor;
  }

  async getContractorByUserId(userId: string): Promise<Vendor | undefined> {
    const [contractor] = await db.select().from(vendors).where(
      and(
        eq(vendors.userId, userId),
        eq(vendors.isActiveContractor, true)
      )
    );
    return contractor;
  }

  async getContractorVendorsByUserId(userId: string): Promise<Vendor[]> {
    return db.select().from(vendors).where(
      and(
        eq(vendors.userId, userId),
        eq(vendors.isActiveContractor, true)
      )
    );
  }

  async updateVendor(id: string, vendorData: Partial<InsertVendor>): Promise<Vendor> {
    const [vendor] = await db
      .update(vendors)
      .set(vendorData)
      .where(eq(vendors.id, id))
      .returning();
    return vendor;
  }

  // Contractor Availability operations
  async getContractorAvailability(contractorId: string): Promise<ContractorAvailability[]> {
    return db.select().from(contractorAvailability)
      .where(eq(contractorAvailability.contractorId, contractorId))
      .orderBy(asc(contractorAvailability.dayOfWeek));
  }

  async createContractorAvailability(availability: InsertContractorAvailability): Promise<ContractorAvailability> {
    const [created] = await db.insert(contractorAvailability).values(availability).returning();
    return created;
  }

  async updateContractorAvailability(id: string, availabilityData: Partial<InsertContractorAvailability>): Promise<ContractorAvailability> {
    const [updated] = await db
      .update(contractorAvailability)
      .set(availabilityData)
      .where(eq(contractorAvailability.id, id))
      .returning();
    return updated;
  }

  async deleteContractorAvailability(id: string): Promise<void> {
    await db.delete(contractorAvailability).where(eq(contractorAvailability.id, id));
  }

  // Contractor Blackout operations
  async getContractorBlackouts(contractorId: string): Promise<ContractorBlackout[]> {
    return db.select().from(contractorBlackouts)
      .where(eq(contractorBlackouts.contractorId, contractorId))
      .orderBy(asc(contractorBlackouts.startDate));
  }

  async createContractorBlackout(blackout: InsertContractorBlackout): Promise<ContractorBlackout> {
    const [created] = await db.insert(contractorBlackouts).values(blackout).returning();
    return created;
  }

  async updateContractorBlackout(id: string, blackoutData: Partial<InsertContractorBlackout>): Promise<ContractorBlackout> {
    const [updated] = await db
      .update(contractorBlackouts)
      .set(blackoutData)
      .where(eq(contractorBlackouts.id, id))
      .returning();
    return updated;
  }

  async deleteContractorBlackout(id: string): Promise<void> {
    await db.delete(contractorBlackouts).where(eq(contractorBlackouts.id, id));
  }

  // Quote operations
  async getContractorQuotes(contractorId: string): Promise<Quote[]> {
    return db.select().from(quotes)
      .where(eq(quotes.contractorId, contractorId))
      .orderBy(desc(quotes.createdAt));
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async getQuoteWithLineItems(id: string): Promise<{ quote: Quote; lineItems: QuoteLineItem[] } | undefined> {
    const quote = await this.getQuote(id);
    if (!quote) return undefined;
    
    const lineItems = await this.getQuoteLineItems(id);
    return { quote, lineItems };
  }

  async createQuote(quoteData: InsertQuote): Promise<Quote> {
    const [quote] = await db.insert(quotes).values(quoteData).returning();
    return quote;
  }

  async updateQuote(id: string, quoteData: Partial<InsertQuote>): Promise<Quote> {
    const [quote] = await db
      .update(quotes)
      .set({ ...quoteData, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return quote;
  }

  async updateQuoteWithLineItems(
    id: string, 
    quoteData: Partial<InsertQuote>,
    lineItemsData: InsertQuoteLineItem[]
  ): Promise<{ quote: Quote; lineItems: QuoteLineItem[] }> {
    return await db.transaction(async (tx) => {
      // Step 1: Delete all existing line items for this quote
      await tx.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, id));
      
      // Step 2: Create all new line items
      const newLineItems: QuoteLineItem[] = [];
      for (const lineItemData of lineItemsData) {
        const [lineItem] = await tx.insert(quoteLineItems).values({
          ...lineItemData,
          quoteId: id,
        }).returning();
        newLineItems.push(lineItem);
      }
      
      // Step 3: Update the quote
      const [updatedQuote] = await tx
        .update(quotes)
        .set({ ...quoteData, updatedAt: new Date() })
        .where(eq(quotes.id, id))
        .returning();
      
      return { quote: updatedQuote, lineItems: newLineItems };
    });
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  async getQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]> {
    return db.select().from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quoteId))
      .orderBy(asc(quoteLineItems.displayOrder));
  }

  async createQuoteLineItem(lineItemData: InsertQuoteLineItem): Promise<QuoteLineItem> {
    const [lineItem] = await db.insert(quoteLineItems).values(lineItemData).returning();
    return lineItem;
  }

  async updateQuoteLineItem(id: string, lineItemData: Partial<InsertQuoteLineItem>): Promise<QuoteLineItem> {
    const [lineItem] = await db
      .update(quoteLineItems)
      .set(lineItemData)
      .where(eq(quoteLineItems.id, id))
      .returning();
    return lineItem;
  }

  async deleteQuoteLineItem(id: string): Promise<void> {
    await db.delete(quoteLineItems).where(eq(quoteLineItems.id, id));
  }

  // Appointment operations
  async getAppointments(orgId: string): Promise<Appointment[]> {
    const result = await db
      .select({
        id: appointments.id,
        caseId: appointments.caseId,
        contractorId: appointments.contractorId,
        scheduledStartAt: appointments.scheduledStartAt,
        scheduledEndAt: appointments.scheduledEndAt,
        actualStartAt: appointments.actualStartAt,
        actualEndAt: appointments.actualEndAt,
        status: appointments.status,
        notes: appointments.notes,
        requiresTenantAccess: appointments.requiresTenantAccess,
        tenantApproved: appointments.tenantApproved,
        tenantApprovedAt: appointments.tenantApprovedAt,
        approvalToken: appointments.approvalToken,
        approvalExpiresAt: appointments.approvalExpiresAt,
        proposedBy: appointments.proposedBy,
        googleCalendarEventId: appointments.googleCalendarEventId,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
      })
      .from(appointments)
      .innerJoin(smartCases, eq(appointments.caseId, smartCases.id))
      .where(eq(smartCases.orgId, orgId))
      .orderBy(desc(appointments.scheduledStartAt));
    
    return result;
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment;
  }

  async getContractorAppointments(contractorId: string): Promise<Appointment[]> {
    return db.select().from(appointments)
      .where(eq(appointments.contractorId, contractorId))
      .orderBy(asc(appointments.scheduledStartAt));
  }

  async getCaseAppointments(caseId: string): Promise<Appointment[]> {
    return db.select().from(appointments)
      .where(eq(appointments.caseId, caseId))
      .orderBy(desc(appointments.scheduledStartAt));
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [created] = await db.insert(appointments).values(appointment).returning();
    return created;
  }

  async updateAppointment(id: string, appointmentData: Partial<InsertAppointment>): Promise<Appointment> {
    const [updated] = await db
      .update(appointments)
      .set(appointmentData)
      .where(eq(appointments.id, id))
      .returning();
    return updated;
  }

  async deleteAppointment(id: string): Promise<void> {
    await db.delete(appointments).where(eq(appointments.id, id));
  }

  // AI Triage operations
  async getTriageConversation(id: string): Promise<TriageConversation | undefined> {
    const [conversation] = await db.select().from(triageConversations)
      .where(eq(triageConversations.id, id));
    return conversation;
  }

  async createTriageConversation(conversation: InsertTriageConversation): Promise<string> {
    const [created] = await db.insert(triageConversations).values(conversation).returning();
    return created.id;
  }

  async updateTriageConversation(id: string, conversationData: Partial<InsertTriageConversation>): Promise<TriageConversation> {
    const [updated] = await db
      .update(triageConversations)
      .set({ ...conversationData, updatedAt: new Date() })
      .where(eq(triageConversations.id, id))
      .returning();
    return updated;
  }

  async getTriageMessages(conversationId: string): Promise<TriageMessage[]> {
    return db.select().from(triageMessages)
      .where(eq(triageMessages.conversationId, conversationId))
      .orderBy(asc(triageMessages.createdAt));
  }

  async createTriageMessage(message: InsertTriageMessage): Promise<TriageMessage> {
    const [created] = await db.insert(triageMessages).values(message).returning();
    return created;
  }

  // User Category operations
  async getUserCategories(orgId: string): Promise<UserCategory[]> {
    return db.select().from(userCategories)
      .where(and(eq(userCategories.orgId, orgId), eq(userCategories.isActive, true)))
      .orderBy(asc(userCategories.name));
  }

  async getUserCategory(id: string): Promise<UserCategory | undefined> {
    const [category] = await db.select().from(userCategories).where(eq(userCategories.id, id));
    return category;
  }

  async createUserCategory(category: InsertUserCategory): Promise<UserCategory> {
    const [created] = await db.insert(userCategories).values(category).returning();
    return created;
  }

  async updateUserCategory(id: string, categoryData: Partial<InsertUserCategory>): Promise<UserCategory> {
    const [updated] = await db
      .update(userCategories)
      .set(categoryData)
      .where(eq(userCategories.id, id))
      .returning();
    return updated;
  }

  async deleteUserCategory(id: string): Promise<void> {
    await db.update(userCategories)
      .set({ isActive: false })
      .where(eq(userCategories.id, id));
  }

  // User Category Member operations
  async getCategoryMembers(categoryId: string): Promise<UserCategoryMember[]> {
    return db.select().from(userCategoryMembers)
      .where(and(eq(userCategoryMembers.categoryId, categoryId), eq(userCategoryMembers.isActive, true)))
      .orderBy(asc(userCategoryMembers.createdAt));
  }

  async getUserCategoryMemberships(userId: string): Promise<UserCategoryMember[]> {
    return db.select().from(userCategoryMembers)
      .where(and(eq(userCategoryMembers.userId, userId), eq(userCategoryMembers.isActive, true)))
      .orderBy(asc(userCategoryMembers.createdAt));
  }

  async addCategoryMember(member: InsertUserCategoryMember): Promise<UserCategoryMember> {
    const [created] = await db.insert(userCategoryMembers).values(member).returning();
    return created;
  }

  async removeCategoryMember(categoryId: string, userId: string): Promise<void> {
    await db.update(userCategoryMembers)
      .set({ isActive: false })
      .where(and(
        eq(userCategoryMembers.categoryId, categoryId),
        eq(userCategoryMembers.userId, userId)
      ));
  }

  // Messaging operations
  async getMessageThreads(orgId: string, userId: string): Promise<MessageThread[]> {
    const threads = await db
      .select()
      .from(messageThreads)
      .innerJoin(threadParticipants, eq(messageThreads.id, threadParticipants.threadId))
      .where(and(
        eq(messageThreads.orgId, orgId),
        eq(threadParticipants.userId, userId)
      ))
      .orderBy(desc(messageThreads.lastMessageAt));
    
    return threads.map(t => t.message_threads);
  }

  async getMessageThread(id: string): Promise<MessageThread | undefined> {
    const [thread] = await db.select().from(messageThreads).where(eq(messageThreads.id, id));
    return thread;
  }

  async createMessageThread(thread: InsertMessageThread, participantIds: string[]): Promise<MessageThread> {
    const [created] = await db.insert(messageThreads).values(thread).returning();
    
    // Add participants
    await db.insert(threadParticipants).values(
      participantIds.map(userId => ({
        threadId: created.id,
        userId
      }))
    );
    
    return created;
  }

  async getThreadMessages(threadId: string): Promise<ChatMessage[]> {
    return db.select().from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(asc(chatMessages.createdAt));
  }

  async sendMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(message).returning();
    
    // Update thread's lastMessageAt
    await db.update(messageThreads)
      .set({ lastMessageAt: created.createdAt })
      .where(eq(messageThreads.id, message.threadId!));
    
    return created;
  }

  async markThreadAsRead(threadId: string, userId: string): Promise<void> {
    await db.update(threadParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(
        eq(threadParticipants.threadId, threadId),
        eq(threadParticipants.userId, userId)
      ));
  }

  // Approval Policy operations
  async getApprovalPolicies(orgId: string): Promise<ApprovalPolicy[]> {
    return db.select().from(approvalPolicies)
      .where(eq(approvalPolicies.orgId, orgId))
      .orderBy(desc(approvalPolicies.createdAt));
  }

  async getApprovalPolicy(id: string): Promise<ApprovalPolicy | undefined> {
    const [policy] = await db.select().from(approvalPolicies)
      .where(eq(approvalPolicies.id, id));
    return policy;
  }

  async createApprovalPolicy(policy: InsertApprovalPolicy): Promise<ApprovalPolicy> {
    const [created] = await db.insert(approvalPolicies).values(policy).returning();
    return created;
  }

  async updateApprovalPolicy(id: string, policy: Partial<InsertApprovalPolicy>): Promise<ApprovalPolicy> {
    // Strip immutable fields
    const { orgId, ...safePolicy } = policy;
    
    const [updated] = await db.update(approvalPolicies)
      .set({ ...safePolicy, updatedAt: new Date() })
      .where(eq(approvalPolicies.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Policy not found");
    }
    
    return updated;
  }

  async deleteApprovalPolicy(id: string): Promise<void> {
    const result = await db.delete(approvalPolicies)
      .where(eq(approvalPolicies.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error("Policy not found");
    }
  }

  // Appointment Proposal operations
  async getAppointmentProposals(caseId: string): Promise<AppointmentProposal[]> {
    return db.select().from(appointmentProposals)
      .where(eq(appointmentProposals.caseId, caseId))
      .orderBy(desc(appointmentProposals.createdAt));
  }

  async getAppointmentProposal(id: string): Promise<AppointmentProposal | undefined> {
    const [proposal] = await db.select().from(appointmentProposals)
      .where(eq(appointmentProposals.id, id));
    return proposal;
  }

  async createAppointmentProposal(proposal: InsertAppointmentProposal): Promise<AppointmentProposal> {
    const [created] = await db.insert(appointmentProposals).values(proposal).returning();
    return created;
  }

  async updateAppointmentProposal(id: string, proposal: Partial<InsertAppointmentProposal>): Promise<AppointmentProposal> {
    const [updated] = await db.update(appointmentProposals)
      .set({ ...proposal, updatedAt: new Date() })
      .where(eq(appointmentProposals.id, id))
      .returning();
    return updated;
  }

  async deleteAppointmentProposal(id: string): Promise<void> {
    await db.delete(appointmentProposals).where(eq(appointmentProposals.id, id));
  }

  // Proposal Slot operations
  async getProposalSlots(proposalId: string): Promise<ProposalSlot[]> {
    return db.select().from(proposalSlots)
      .where(eq(proposalSlots.proposalId, proposalId))
      .orderBy(asc(proposalSlots.slotNumber));
  }

  async getProposalSlot(id: string): Promise<ProposalSlot | undefined> {
    const [slot] = await db.select().from(proposalSlots)
      .where(eq(proposalSlots.id, id));
    return slot;
  }

  async createProposalSlot(slot: InsertProposalSlot): Promise<ProposalSlot> {
    const [created] = await db.insert(proposalSlots).values(slot).returning();
    return created;
  }

  async deleteProposalSlot(id: string): Promise<void> {
    await db.delete(proposalSlots).where(eq(proposalSlots.id, id));
  }

  // Omnichannel Communication operations
  async getChannelMessages(orgId: string, filters?: { channelType?: string; status?: string; tenantId?: string; contractorId?: string; externalId?: string }): Promise<ChannelMessage[]> {
    // If searching by externalId, skip orgId filter since externalId is unique
    let query = filters?.externalId 
      ? db.select().from(channelMessages)
      : db.select().from(channelMessages).where(eq(channelMessages.orgId, orgId));
    
    if (filters?.channelType) {
      query = query.where(eq(channelMessages.channelType, filters.channelType as any));
    }
    if (filters?.status) {
      query = query.where(eq(channelMessages.status, filters.status as any));
    }
    if (filters?.tenantId) {
      query = query.where(eq(channelMessages.tenantId, filters.tenantId));
    }
    if (filters?.contractorId) {
      query = query.where(eq(channelMessages.contractorId, filters.contractorId));
    }
    if (filters?.externalId) {
      query = query.where(eq(channelMessages.externalId, filters.externalId));
    }
    
    return query.orderBy(desc(channelMessages.createdAt));
  }

  async getChannelMessage(id: string): Promise<ChannelMessage | undefined> {
    const [message] = await db.select().from(channelMessages).where(eq(channelMessages.id, id));
    return message;
  }

  async createChannelMessage(message: InsertChannelMessage): Promise<ChannelMessage> {
    const [created] = await db.insert(channelMessages).values(message).returning();
    return created;
  }

  async updateChannelMessage(id: string, message: Partial<InsertChannelMessage>): Promise<ChannelMessage> {
    const [updated] = await db.update(channelMessages)
      .set(message)
      .where(eq(channelMessages.id, id))
      .returning();
    return updated;
  }

  // Equipment Failure operations
  async getEquipmentFailures(orgId: string, filters?: { equipmentType?: string; propertyId?: string; unitId?: string }): Promise<EquipmentFailure[]> {
    let query = db.select().from(equipmentFailures).where(eq(equipmentFailures.orgId, orgId));
    
    if (filters?.equipmentType) {
      query = query.where(eq(equipmentFailures.equipmentType, filters.equipmentType));
    }
    if (filters?.propertyId) {
      query = query.where(eq(equipmentFailures.propertyId, filters.propertyId));
    }
    if (filters?.unitId) {
      query = query.where(eq(equipmentFailures.unitId, filters.unitId));
    }
    
    return query.orderBy(desc(equipmentFailures.failureDate));
  }

  async createEquipmentFailure(failure: InsertEquipmentFailure): Promise<EquipmentFailure> {
    const [created] = await db.insert(equipmentFailures).values(failure).returning();
    return created;
  }

  // Predictive Insights operations
  async getPredictiveInsights(orgId: string, filters?: { isActive?: boolean; insightType?: string }): Promise<PredictiveInsight[]> {
    let query = db.select().from(predictiveInsights).where(eq(predictiveInsights.orgId, orgId));
    
    if (filters?.isActive !== undefined) {
      query = query.where(eq(predictiveInsights.isActive, filters.isActive));
    }
    if (filters?.insightType) {
      query = query.where(eq(predictiveInsights.insightType, filters.insightType));
    }
    
    return query.orderBy(desc(predictiveInsights.createdAt));
  }

  async createPredictiveInsight(insight: InsertPredictiveInsight): Promise<PredictiveInsight> {
    const [created] = await db.insert(predictiveInsights).values(insight).returning();
    return created;
  }

  async updatePredictiveInsight(id: string, insight: Partial<InsertPredictiveInsight>): Promise<PredictiveInsight> {
    const [updated] = await db.update(predictiveInsights)
      .set({ ...insight, updatedAt: new Date() })
      .where(eq(predictiveInsights.id, id))
      .returning();
    return updated;
  }

  // Channel Settings operations
  async getChannelSettings(orgId: string): Promise<ChannelSettings | undefined> {
    const [settings] = await db.select().from(channelSettings).where(eq(channelSettings.orgId, orgId));
    return settings;
  }

  async updateChannelSettings(orgId: string, settings: Partial<InsertChannelSettings>): Promise<ChannelSettings> {
    // Try to update first
    const [updated] = await db.update(channelSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(channelSettings.orgId, orgId))
      .returning();
    
    // If no record exists, create one
    if (!updated) {
      const [created] = await db.insert(channelSettings)
        .values({ ...settings, orgId })
        .returning();
      return created;
    }
    
    return updated;
  }

  // Equipment operations
  async getEquipment(propertyId: string): Promise<Equipment[]> {
    return db.select().from(equipment)
      .where(eq(equipment.propertyId, propertyId))
      .orderBy(asc(equipment.equipmentType));
  }

  async getEquipmentById(id: string): Promise<Equipment | undefined> {
    const [result] = await db.select().from(equipment).where(eq(equipment.id, id));
    return result;
  }

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const [created] = await db.insert(equipment).values(equipmentData).returning();
    return created;
  }

  async updateEquipment(id: string, equipmentData: Partial<InsertEquipment>): Promise<Equipment> {
    const [updated] = await db.update(equipment)
      .set({ ...equipmentData, updatedAt: new Date() })
      .where(eq(equipment.id, id))
      .returning();
    return updated;
  }

  async deleteEquipment(id: string): Promise<void> {
    await db.delete(equipment).where(eq(equipment.id, id));
  }

  async getOrgEquipment(orgId: string): Promise<Equipment[]> {
    return db.select().from(equipment)
      .where(eq(equipment.orgId, orgId))
      .orderBy(asc(equipment.equipmentType));
  }

  // Team operations
  async getTeams(orgId: string): Promise<Team[]> {
    return db.select().from(teams)
      .where(eq(teams.orgId, orgId))
      .orderBy(asc(teams.name));
  }

  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async updateTeam(id: string, teamData: Partial<InsertTeam>): Promise<Team> {
    const [updated] = await db.update(teams)
      .set(teamData)
      .where(eq(teams.id, id))
      .returning();
    return updated;
  }

  async deleteTeam(id: string): Promise<void> {
    // First, check if there are any jobs assigned to this team
    const jobsWithTeam = await db
      .select()
      .from(scheduledJobs)
      .where(eq(scheduledJobs.teamId, id))
      .limit(1);
    
    if (jobsWithTeam.length > 0) {
      throw new Error('Cannot delete team with assigned jobs. Please reassign or delete the jobs first.');
    }
    
    await db.delete(teams).where(eq(teams.id, id));
  }

  // Scheduled Job operations
  async getScheduledJobs(orgId: string, filters?: { teamId?: string; status?: string; caseId?: string }): Promise<any[]> {
    let query = db.select({
      ...scheduledJobs,
      caseStatus: smartCases.status,
      teamName: teams.name,
      teamColor: teams.color,
      teamSpecialty: teams.specialty,
    }).from(scheduledJobs)
      .leftJoin(smartCases, eq(scheduledJobs.caseId, smartCases.id))
      .leftJoin(teams, eq(scheduledJobs.teamId, teams.id))
      .where(eq(scheduledJobs.orgId, orgId));
    
    if (filters?.teamId) {
      query = query.where(eq(scheduledJobs.teamId, filters.teamId));
    }
    if (filters?.status) {
      query = query.where(eq(scheduledJobs.status, filters.status as any));
    }
    if (filters?.caseId) {
      query = query.where(eq(scheduledJobs.caseId, filters.caseId));
    }
    
    return query.orderBy(asc(scheduledJobs.scheduledStartAt));
  }

  async getScheduledJob(id: string): Promise<ScheduledJob | undefined> {
    const [job] = await db.select().from(scheduledJobs).where(eq(scheduledJobs.id, id));
    return job;
  }

  async createScheduledJob(job: InsertScheduledJob): Promise<ScheduledJob> {
    const [newJob] = await db.insert(scheduledJobs).values(job).returning();
    return newJob;
  }

  async updateScheduledJob(id: string, jobData: Partial<InsertScheduledJob>): Promise<ScheduledJob> {
    const [updated] = await db.update(scheduledJobs)
      .set({ ...jobData, updatedAt: new Date() })
      .where(eq(scheduledJobs.id, id))
      .returning();
    return updated;
  }

  async deleteScheduledJob(id: string): Promise<void> {
    await db.delete(scheduledJobs).where(eq(scheduledJobs.id, id));
  }

  // Counter-Proposal operations
  async createCounterProposal(proposal: InsertCounterProposal): Promise<CounterProposal> {
    const [newProposal] = await db.insert(counterProposals).values(proposal).returning();
    return newProposal;
  }

  async getCounterProposalsByJob(jobId: string): Promise<CounterProposal[]> {
    return db.select().from(counterProposals).where(eq(counterProposals.scheduledJobId, jobId)).orderBy(desc(counterProposals.createdAt));
  }

  async getCounterProposal(id: string): Promise<CounterProposal | undefined> {
    const [proposal] = await db.select().from(counterProposals).where(eq(counterProposals.id, id));
    return proposal;
  }

  async updateCounterProposal(id: string, proposalData: Partial<InsertCounterProposal>): Promise<CounterProposal> {
    const [updated] = await db.update(counterProposals)
      .set(proposalData)
      .where(eq(counterProposals.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
