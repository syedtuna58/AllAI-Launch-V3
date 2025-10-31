import type { IStorage } from './storage';
import { calculateReplacementYear, getEquipmentDefinition, EQUIPMENT_CATALOG } from './equipment-catalog';

/**
 * Predictive Analytics Engine
 * Analyzes equipment failures and generates predictions for maintenance needs
 */
export class PredictiveAnalyticsEngine {
  constructor(private storage: IStorage) {}

  /**
   * Analyze equipment failure patterns and generate predictions
   */
  async generatePredictions(orgId: string): Promise<void> {
    // First, generate predictions based on equipment inventory (always available)
    await this.generateEquipmentInventoryPredictions(orgId);

    // Get all equipment failures for the organization
    const failures = await this.storage.getEquipmentFailures(orgId, {});

    // Group failures by equipment type
    const failuresByType = this.groupFailuresByType(failures);

    // Generate predictions for each equipment type (historical data)
    for (const [equipmentType, typeFailures] of Object.entries(failuresByType)) {
      if (typeFailures.length < 2) continue; // Need at least 2 data points

      await this.generateEquipmentPrediction(orgId, equipmentType, typeFailures);
    }

    // Identify high-maintenance units
    await this.identifyHighMaintenanceUnits(orgId, failures);

    // Identify problematic contractors (if failures mention quality issues)
    await this.identifyProblematicContractors(orgId);
  }

  /**
   * Generate predictions based on equipment inventory using industry-standard lifespans
   */
  private async generateEquipmentInventoryPredictions(orgId: string): Promise<void> {
    // Get all equipment for the organization
    const allEquipment = await this.storage.getOrgEquipment(orgId);
    
    if (allEquipment.length === 0) return;

    // Get properties for property details
    const properties = await this.storage.getProperties(orgId);
    const propertyMap = new Map(properties.map(p => [p.id, p]));

    const currentYear = new Date().getFullYear();

    for (const eq of allEquipment) {
      const property = propertyMap.get(eq.propertyId);
      if (!property) continue;

      const definition = getEquipmentDefinition(eq.equipmentType);
      
      // Handle custom equipment (not in catalog)
      const isCustomEquipment = !definition;
      
      // For custom equipment, we need a custom lifespan to make predictions
      if (isCustomEquipment && !eq.customLifespanYears) continue;

      const age = currentYear - eq.installYear;
      const replacementYear = calculateReplacementYear(
        eq.installYear,
        eq.equipmentType,
        property.state,
        eq.customLifespanYears ?? undefined,
        eq.useClimateAdjustment
      );

      const lifespan = replacementYear - eq.installYear;
      const remainingYears = replacementYear - currentYear;

      // Generate prediction for all equipment regardless of timeline
      // Adjust confidence based on how close to replacement
      let confidence: number;
      let statusText: string;
      
      if (remainingYears <= 0) {
        confidence = 0.95;
        statusText = 'has exceeded its expected lifespan';
      } else if (remainingYears <= 2) {
        confidence = (1 - (remainingYears / lifespan)) * 0.85;
        statusText = `is approaching end of lifespan (${remainingYears} ${remainingYears === 1 ? 'year' : 'years'} remaining)`;
      } else if (remainingYears <= 5) {
        confidence = 0.70;
        statusText = `will need replacement in ${remainingYears} years`;
      } else {
        confidence = 0.60;
        statusText = `is projected for replacement in ${remainingYears} years`;
      }
      
      const clampedConfidence = Math.max(0.60, Math.min(0.95, confidence));

      // Generate friendly display name for custom equipment
      const displayName = isCustomEquipment 
        ? eq.equipmentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        : definition.displayName;
      
      const description = isCustomEquipment
        ? 'Custom equipment'
        : definition.description;
      
      const category = isCustomEquipment
        ? 'custom'
        : definition.category;

      const prediction = {
        orgId,
        insightType: 'equipment_failure',
        equipmentType: eq.equipmentType,
        propertyId: eq.propertyId,
        unitId: eq.unitId || undefined,
        prediction: `${displayName} at ${property.name} ${statusText}. Installed in ${eq.installYear}, typical lifespan is ${lifespan} years.`,
        confidence: clampedConfidence.toFixed(2),
        predictedDate: new Date(replacementYear, 0, 1),
        estimatedCost: this.estimateReplacementCost(eq.equipmentType),
        basedOnDataPoints: 0, // Industry average, not historical data
        reasoning: `${description}. Based on ${isCustomEquipment ? 'custom' : 'industry-standard'} lifespan of ${eq.customLifespanYears || definition?.defaultLifespanYears} years${eq.useClimateAdjustment ? ' with climate adjustment for ' + property.state : ''}. Equipment is currently ${age} years old.`,
        recommendations: this.getRecommendationsForEquipment(category, remainingYears),
      };

      // Check for duplicates
      const existing = await this.storage.getPredictiveInsights(orgId, {
        isActive: true,
        insightType: 'equipment_failure',
      });

      const duplicate = existing.find(
        p => p.equipmentType === eq.equipmentType && 
             p.propertyId === eq.propertyId && 
             p.unitId === eq.unitId
      );

      if (!duplicate) {
        await this.storage.createPredictiveInsight(prediction);
      }
    }
  }

  /**
   * Get recommendations based on equipment category and time remaining
   */
  private getRecommendationsForEquipment(category: string, remainingYears: number): string[] {
    // Overdue or past lifespan
    if (remainingYears <= 0) {
      return category === 'critical'
        ? [
            'URGENT: Schedule replacement immediately to prevent property damage',
            'Obtain quotes from multiple contractors',
            'Consider temporary monitoring or backup solutions',
          ]
        : [
            'Schedule replacement within next 3-6 months',
            'Get multiple quotes to compare pricing',
            'Plan replacement during low-occupancy period if possible',
          ];
    }

    // Within 2 years - approaching replacement
    if (remainingYears <= 2) {
      return category === 'critical'
        ? [
            'Schedule professional inspection within 30 days',
            'Budget for replacement in next 12 months',
            'Consider preventive maintenance to extend lifespan',
            'Obtain preliminary quotes for planning',
          ]
        : [
            'Schedule inspection to assess current condition',
            'Begin budgeting for replacement',
            'Research current market pricing for this equipment',
          ];
    }

    // 3-5 years - upcoming replacement
    if (remainingYears <= 5) {
      return category === 'critical'
        ? [
            'Add to long-term maintenance plan',
            'Schedule periodic inspections to monitor condition',
            'Start capital reserve planning for replacement',
          ]
        : [
            'Monitor equipment condition during routine maintenance',
            'Include in capital expenditure forecast',
            'Track performance for early warning signs',
          ];
    }

    // 5+ years - healthy equipment
    return [
      'Equipment is in healthy condition',
      'Continue routine maintenance schedule',
      'Review during annual property assessments',
    ];
  }

  /**
   * Generate prediction for specific equipment type
   */
  private async generateEquipmentPrediction(
    orgId: string,
    equipmentType: string,
    failures: any[]
  ): Promise<void> {
    // Calculate average age at failure
    const agesAtFailure = failures
      .filter(f => f.ageAtFailure)
      .map(f => f.ageAtFailure);

    if (agesAtFailure.length === 0) return;

    const averageAge = agesAtFailure.reduce((a, b) => a + b, 0) / agesAtFailure.length;
    const stdDev = this.calculateStdDev(agesAtFailure);

    // Find equipment of this type that's approaching failure age
    const properties = await this.storage.getProperties(orgId);
    
    for (const property of properties) {
      // Check building-level equipment
      const buildingEquipment = this.getBuildingEquipment(property, equipmentType);
      
      for (const equipment of buildingEquipment) {
        const age = equipment.age;
        if (age && age >= averageAge * 0.8) {
          // Equipment is at 80% of average failure age
          const confidence = 1 - Math.abs(age - averageAge) / (stdDev || 1);
          const clampedConfidence = Math.max(0.3, Math.min(0.95, confidence));

          const prediction = {
            orgId,
            insightType: 'equipment_failure',
            equipmentType,
            propertyId: property.id,
            prediction: `${equipmentType.toUpperCase()} at ${property.name} is ${age} years old and may need replacement soon. Average failure age is ${Math.round(averageAge)} years.`,
            confidence: clampedConfidence.toFixed(2),
            predictedDate: this.calculatePredictedDate(age, averageAge),
            estimatedCost: this.estimateReplacementCost(equipmentType),
            basedOnDataPoints: failures.length,
            reasoning: `Based on ${failures.length} similar failures, ${equipmentType} typically fails around ${Math.round(averageAge)} years. This unit is currently ${age} years old.`,
            recommendations: [
              'Schedule inspection to assess current condition',
              'Budget for potential replacement in next 12-24 months',
              'Consider preventive maintenance to extend lifespan',
            ],
          };

          // Check if prediction already exists
          const existing = await this.storage.getPredictiveInsights(orgId, {
            isActive: true,
            insightType: 'equipment_failure',
          });

          const duplicate = existing.find(
            p => p.equipmentType === equipmentType && p.propertyId === property.id
          );

          if (!duplicate) {
            await this.storage.createPredictiveInsight(prediction);
          }
        }
      }
    }
  }

  /**
   * Identify units with high maintenance needs
   */
  private async identifyHighMaintenanceUnits(orgId: string, failures: any[]): Promise<void> {
    // Group failures by unit
    const failuresByUnit: Record<string, any[]> = {};
    
    failures.forEach(failure => {
      if (failure.unitId) {
        if (!failuresByUnit[failure.unitId]) {
          failuresByUnit[failure.unitId] = [];
        }
        failuresByUnit[failure.unitId].push(failure);
      }
    });

    // Identify units with more than 3 failures
    for (const [unitId, unitFailures] of Object.entries(failuresByUnit)) {
      if (unitFailures.length >= 3) {
        const unit = await this.storage.getUnit(unitId);
        if (!unit) continue;

        const property = await this.storage.getProperty(unit.propertyId);
        if (!property) continue;

        const totalCost = unitFailures
          .filter(f => f.repairCost)
          .reduce((sum, f) => sum + parseFloat(f.repairCost), 0);

        const prediction = {
          orgId,
          insightType: 'high_maintenance_unit',
          propertyId: property.id,
          unitId,
          prediction: `Unit ${unit.label} at ${property.name} has had ${unitFailures.length} maintenance issues in recent history, costing approximately $${Math.round(totalCost)}.`,
          confidence: 0.85,
          basedOnDataPoints: unitFailures.length,
          reasoning: `This unit has required significantly more maintenance than average, suggesting underlying issues or aging equipment.`,
          recommendations: [
            'Consider comprehensive unit inspection',
            'Review tenant usage patterns',
            'Evaluate cost-benefit of major renovations vs ongoing repairs',
          ],
        };

        await this.storage.createPredictiveInsight(prediction);
      }
    }
  }

  /**
   * Identify contractors with quality issues
   */
  private async identifyProblematicContractors(orgId: string): Promise<void> {
    // Get all cases for the organization
    const cases = await this.storage.getSmartCases(orgId);
    
    // Group by contractor and look for patterns
    const casesByContractor: Record<string, any[]> = {};
    
    cases.forEach(caseItem => {
      if (caseItem.assignedContractorId) {
        if (!casesByContractor[caseItem.assignedContractorId]) {
          casesByContractor[caseItem.assignedContractorId] = [];
        }
        casesByContractor[caseItem.assignedContractorId].push(caseItem);
      }
    });

    // Analyze contractor performance
    for (const [contractorId, contractorCases] of Object.entries(casesByContractor)) {
      if (contractorCases.length < 5) continue; // Need significant data

      const contractor = await this.storage.getContractor(contractorId);
      if (!contractor) continue;

      // Check for red flags: multiple cases on hold, high costs, slow completion
      const onHoldCases = contractorCases.filter(c => c.status === 'On Hold').length;
      const resolvedCases = contractorCases.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
      const completionRate = resolvedCases / contractorCases.length;

      if (onHoldCases >= 2 || completionRate < 0.6) {
        const prediction = {
          orgId,
          insightType: 'problematic_contractor',
          contractorId,
          prediction: `${contractor.name} has ${contractorCases.length} assigned cases with ${onHoldCases} on hold and ${Math.round(completionRate * 100)}% completion rate.`,
          confidence: 0.70,
          basedOnDataPoints: contractorCases.length,
          reasoning: `Low completion rate or multiple stalled projects may indicate reliability issues.`,
          recommendations: [
            'Review contractor performance directly',
            'Consider alternative contractors for new work',
            'Follow up on stalled projects',
          ],
        };

        await this.storage.createPredictiveInsight(prediction);
      }
    }
  }

  /**
   * Helper: Group failures by equipment type
   */
  private groupFailuresByType(failures: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    failures.forEach(failure => {
      if (!grouped[failure.equipmentType]) {
        grouped[failure.equipmentType] = [];
      }
      grouped[failure.equipmentType].push(failure);
    });

    return grouped;
  }

  /**
   * Helper: Get building equipment by type
   */
  private getBuildingEquipment(property: any, equipmentType: string): Array<{ age: number; location?: string }> {
    const equipment: Array<{ age: number; location?: string }> = [];
    const currentYear = new Date().getFullYear();

    // Map equipment types to property fields
    if (equipmentType.toLowerCase().includes('hvac') && property.buildingHvacYear) {
      equipment.push({
        age: currentYear - property.buildingHvacYear,
        location: property.buildingHvacLocation,
      });
    }
    if (equipmentType.toLowerCase().includes('water') && property.buildingWaterYear) {
      equipment.push({
        age: currentYear - property.buildingWaterYear,
        location: property.buildingWaterLocation,
      });
    }

    return equipment;
  }

  /**
   * Helper: Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Helper: Calculate predicted failure date
   */
  private calculatePredictedDate(currentAge: number, averageFailureAge: number): Date {
    const yearsRemaining = averageFailureAge - currentAge;
    const date = new Date();
    date.setFullYear(date.getFullYear() + Math.max(0, Math.round(yearsRemaining)));
    return date;
  }

  /**
   * Helper: Estimate replacement cost by equipment type
   */
  private estimateReplacementCost(equipmentType: string): number {
    const costs: Record<string, number> = {
      hvac: 5000,
      boiler: 4000,
      water_heater: 1200,
      roof: 15000,
      refrigerator: 800,
      dishwasher: 600,
      washer: 700,
      dryer: 650,
    };

    const type = equipmentType.toLowerCase().replace(/\s+/g, '_');
    return costs[type] || 1000;
  }
}
