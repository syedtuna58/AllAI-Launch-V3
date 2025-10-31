// Equipment catalog with industry-standard lifespans and climate adjustments

export interface EquipmentDefinition {
  type: string;
  displayName: string;
  category: 'critical' | 'moderate' | 'non-critical';
  defaultLifespanYears: number; // Conservative/average/generous based on category
  lifespanRange: { min: number; max: number };
  climateAdjustment: {
    cold: number; // Years to subtract in cold climates (negative = shorter life)
    hot: number; // Years to subtract in hot climates
  };
  description: string;
}

// Cold climate states (shorter roof life, harder on equipment)
export const COLD_CLIMATE_STATES = ['AK', 'MN', 'ND', 'SD', 'WI', 'MI', 'ME', 'VT', 'NH', 'NY', 'MT', 'WY'];

// Hot climate states (harder on HVAC, faster wear)
export const HOT_CLIMATE_STATES = ['AZ', 'NM', 'TX', 'FL', 'LA', 'MS', 'AL', 'GA', 'SC'];

export const EQUIPMENT_CATALOG: EquipmentDefinition[] = [
  // CRITICAL - Property damage risk, use conservative lifespans
  {
    type: 'roof',
    displayName: 'Roof/Shingles',
    category: 'critical',
    defaultLifespanYears: 18,
    lifespanRange: { min: 10, max: 50 },
    climateAdjustment: { cold: -2, hot: -1 },
    description: 'Asphalt shingles - failures can cause water damage',
  },
  {
    type: 'water_heater',
    displayName: 'Water Heater',
    category: 'critical',
    defaultLifespanYears: 8,
    lifespanRange: { min: 8, max: 12 },
    climateAdjustment: { cold: 0, hot: 0 },
    description: 'Failures can cause flooding and water damage',
  },
  {
    type: 'boiler',
    displayName: 'Boiler',
    category: 'critical',
    defaultLifespanYears: 8,
    lifespanRange: { min: 8, max: 12 },
    climateAdjustment: { cold: -1, hot: 0 },
    description: 'Critical heating system - failures can cause property damage in winter',
  },
  {
    type: 'septic_tank',
    displayName: 'Septic Tank',
    category: 'critical',
    defaultLifespanYears: 20,
    lifespanRange: { min: 20, max: 30 },
    climateAdjustment: { cold: 0, hot: 0 },
    description: 'Requires yearly maintenance - failures can be catastrophic',
  },

  // MODERATE - Frustrating but not catastrophic, use average lifespans
  {
    type: 'hvac',
    displayName: 'HVAC System',
    category: 'moderate',
    defaultLifespanYears: 17,
    lifespanRange: { min: 15, max: 20 },
    climateAdjustment: { cold: -1, hot: -2 },
    description: 'Central air conditioning and heating system',
  },
  {
    type: 'furnace',
    displayName: 'Furnace',
    category: 'moderate',
    defaultLifespanYears: 18,
    lifespanRange: { min: 15, max: 20 },
    climateAdjustment: { cold: -1, hot: 0 },
    description: 'Heating system - important for tenant comfort',
  },
  {
    type: 'water_softener',
    displayName: 'Water Softener',
    category: 'moderate',
    defaultLifespanYears: 12,
    lifespanRange: { min: 10, max: 15 },
    climateAdjustment: { cold: 0, hot: 0 },
    description: 'Water treatment system',
  },

  // NON-CRITICAL - Inconvenient only, use generous lifespans
  {
    type: 'refrigerator',
    displayName: 'Refrigerator',
    category: 'non-critical',
    defaultLifespanYears: 14,
    lifespanRange: { min: 10, max: 14 },
    climateAdjustment: { cold: 0, hot: -1 },
    description: 'Kitchen appliance - easily replaced',
  },
  {
    type: 'dishwasher',
    displayName: 'Dishwasher',
    category: 'non-critical',
    defaultLifespanYears: 10,
    lifespanRange: { min: 9, max: 10 },
    climateAdjustment: { cold: 0, hot: 0 },
    description: 'Kitchen appliance',
  },
  {
    type: 'microwave',
    displayName: 'Microwave',
    category: 'non-critical',
    defaultLifespanYears: 10,
    lifespanRange: { min: 8, max: 10 },
    climateAdjustment: { cold: 0, hot: 0 },
    description: 'Kitchen appliance',
  },
  {
    type: 'oven',
    displayName: 'Oven/Range',
    category: 'non-critical',
    defaultLifespanYears: 15,
    lifespanRange: { min: 13, max: 15 },
    climateAdjustment: { cold: 0, hot: 0 },
    description: 'Cooking appliance',
  },
  {
    type: 'washer',
    displayName: 'Washing Machine',
    category: 'non-critical',
    defaultLifespanYears: 12,
    lifespanRange: { min: 10, max: 12 },
    climateAdjustment: { cold: 0, hot: 0 },
    description: 'Laundry appliance',
  },
  {
    type: 'dryer',
    displayName: 'Dryer',
    category: 'non-critical',
    defaultLifespanYears: 12,
    lifespanRange: { min: 10, max: 12 },
    climateAdjustment: { cold: 0, hot: 0 },
    description: 'Laundry appliance',
  },
  {
    type: 'garbage_disposal',
    displayName: 'Garbage Disposal',
    category: 'non-critical',
    defaultLifespanYears: 12,
    lifespanRange: { min: 10, max: 12 },
    climateAdjustment: { cold: 0, hot: 0 },
    description: 'Kitchen waste disposal',
  },
];

/**
 * Get equipment definition by type
 */
export function getEquipmentDefinition(type: string): EquipmentDefinition | undefined {
  return EQUIPMENT_CATALOG.find(eq => eq.type === type);
}

/**
 * Calculate adjusted lifespan based on climate
 */
export function calculateAdjustedLifespan(
  equipmentType: string,
  propertyState: string,
  useClimateAdjustment: boolean = true
): number {
  const definition = getEquipmentDefinition(equipmentType);
  if (!definition) return 10; // Default fallback

  let lifespan = definition.defaultLifespanYears;

  if (useClimateAdjustment) {
    if (COLD_CLIMATE_STATES.includes(propertyState.toUpperCase())) {
      lifespan += definition.climateAdjustment.cold;
    } else if (HOT_CLIMATE_STATES.includes(propertyState.toUpperCase())) {
      lifespan += definition.climateAdjustment.hot;
    }
  }

  return Math.max(lifespan, 1); // Never return 0 or negative
}

/**
 * Calculate when equipment should be replaced
 */
export function calculateReplacementYear(
  installYear: number,
  equipmentType: string,
  propertyState: string,
  customLifespanYears?: number,
  useClimateAdjustment: boolean = true
): number {
  const lifespan = customLifespanYears || calculateAdjustedLifespan(equipmentType, propertyState, useClimateAdjustment);
  return installYear + lifespan;
}
