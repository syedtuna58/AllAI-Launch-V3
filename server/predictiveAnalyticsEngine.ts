import type { IStorage } from './storage';

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
    // Get all equipment failures for the organization
    const failures = await this.storage.getEquipmentFailures(orgId, {});

    // Group failures by equipment type
    const failuresByType = this.groupFailuresByType(failures);

    // Generate predictions for each equipment type
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
