import { contractorSpecialtyTierEnum } from "@shared/schema";

// Comprehensive 6-tier contractor specialty system
// Based on property management needs from residential to commercial

export const contractorSpecialtiesSeedData = [
  // ============================================================================
  // TIER 1 – Core Property Maintenance Fields (Most Common)
  // Covers 80-90% of recurring residential & commercial issues
  // ============================================================================
  { name: "Plumber", tier: "tier1", description: "Leaks, clogs, water heaters, toilets, faucets, pipe bursts", displayOrder: 1 },
  { name: "HVAC Technician", tier: "tier1", description: "Heating, ventilation, cooling, thermostats", displayOrder: 2 },
  { name: "Electrician", tier: "tier1", description: "Wiring, lighting, panels, outlets, switches", displayOrder: 3 },
  { name: "General Contractor / Handyman", tier: "tier1", description: "Minor repairs, drywall, fixtures, patchwork", displayOrder: 4 },
  { name: "Appliance Technician", tier: "tier1", description: "Washers, dryers, dishwashers, ovens, refrigerators", displayOrder: 5 },
  { name: "Carpenter", tier: "tier1", description: "Framing, cabinetry, shelving, trim work", displayOrder: 6 },
  { name: "Painter / Drywall Specialist", tier: "tier1", description: "Interior/exterior painting, wall repair, ceiling patching", displayOrder: 7 },
  { name: "Roofer", tier: "tier1", description: "Leaks, flashing, shingles, gutters, skylights", displayOrder: 8 },
  { name: "Flooring Specialist", tier: "tier1", description: "Tile, hardwood, carpet, laminate installation & repair", displayOrder: 9 },
  { name: "Landscaper / Groundskeeper", tier: "tier1", description: "Lawn, irrigation, tree trimming, garden maintenance", displayOrder: 10 },

  // ============================================================================
  // TIER 2 – Structural & System Specialists
  // Common in multi-unit, institutional, or commercial settings
  // ============================================================================
  { name: "Masonry / Concrete Contractor", tier: "tier2", description: "Foundations, driveways, patios, retaining walls", displayOrder: 11 },
  { name: "Insulation Contractor", tier: "tier2", description: "Attic, wall, crawl space insulation", displayOrder: 12 },
  { name: "Pest Control Technician", tier: "tier2", description: "Insects, rodents, termites, etc.", displayOrder: 13 },
  { name: "Locksmith / Door Hardware Technician", tier: "tier2", description: "Locks, keys, access systems", displayOrder: 14 },
  { name: "Glass & Window Specialist", tier: "tier2", description: "Window repair/replacement, seals, caulking", displayOrder: 15 },
  { name: "Garage Door Technician", tier: "tier2", description: "Door tracks, openers, motors", displayOrder: 16 },
  { name: "Waterproofing / Drainage Specialist", tier: "tier2", description: "Sump pumps, crawlspaces, foundation leaks", displayOrder: 17 },
  { name: "Gutter & Siding Installer", tier: "tier2", description: "Exterior water management, siding repair", displayOrder: 18 },
  { name: "Septic / Sewer Contractor", tier: "tier2", description: "Tank maintenance, pumping, line clearing", displayOrder: 19 },
  { name: "Fire Protection / Sprinkler Technician", tier: "tier2", description: "Sprinklers, alarms, fire extinguishers", displayOrder: 20 },

  // ============================================================================
  // TIER 3 – Mechanical, Technical & Utility Trades
  // Often engaged in large properties, campuses, or hospitals
  // ============================================================================
  { name: "Elevator / Lift Technician", tier: "tier3", description: "Elevator maintenance, repairs, inspections", displayOrder: 21 },
  { name: "Boiler / Steam Plant Technician", tier: "tier3", description: "Boiler systems, steam heat management", displayOrder: 22 },
  { name: "Refrigeration Mechanic (Commercial)", tier: "tier3", description: "Commercial refrigeration systems", displayOrder: 23 },
  { name: "Backflow Prevention / Cross-connection Specialist", tier: "tier3", description: "Water safety systems, backflow testing", displayOrder: 24 },
  { name: "Gas Line / Propane Contractor", tier: "tier3", description: "Gas line installation, repairs, safety checks", displayOrder: 25 },
  { name: "Water Treatment / Filtration Specialist", tier: "tier3", description: "Water purification, filtration systems", displayOrder: 26 },
  { name: "Irrigation / Sprinkler System Technician", tier: "tier3", description: "Irrigation design, installation, maintenance", displayOrder: 27 },
  { name: "Solar Energy / PV Installer", tier: "tier3", description: "Solar panel installation, maintenance", displayOrder: 28 },
  { name: "Generator Technician / Backup Power", tier: "tier3", description: "Generator installation, maintenance, emergency power", displayOrder: 29 },
  { name: "Lighting / Low-voltage Specialist", tier: "tier3", description: "Specialty lighting, low-voltage systems", displayOrder: 30 },

  // ============================================================================
  // TIER 4 – Finishing, Aesthetic, and Lifestyle Contractors
  // Used for upgrades, renovations, or premium maintenance
  // ============================================================================
  { name: "Tile & Grout Specialist", tier: "tier4", description: "Tile installation, grout repair, sealing", displayOrder: 31 },
  { name: "Interior Designer / Renovation Consultant", tier: "tier4", description: "Design, renovation planning, aesthetics", displayOrder: 32 },
  { name: "Countertop / Stone Installer", tier: "tier4", description: "Granite, quartz, marble countertop installation", displayOrder: 33 },
  { name: "Deck / Fence Builder", tier: "tier4", description: "Deck construction, fence installation & repair", displayOrder: 34 },
  { name: "Pool & Spa Technician", tier: "tier4", description: "Pool maintenance, spa repair, chemical balancing", displayOrder: 35 },
  { name: "Window Treatment Installer", tier: "tier4", description: "Blinds, curtains, shades installation", displayOrder: 36 },
  { name: "Soundproofing / Acoustic Specialist", tier: "tier4", description: "Sound insulation, acoustic treatment", displayOrder: 37 },
  { name: "Smart Home / Automation Installer", tier: "tier4", description: "Home automation, smart device installation", displayOrder: 38 },
  { name: "Security System & Camera Installer", tier: "tier4", description: "Security cameras, alarm systems, monitoring", displayOrder: 39 },
  { name: "Signage / Lighting Designer", tier: "tier4", description: "Commercial signage, decorative lighting", displayOrder: 40 },

  // ============================================================================
  // TIER 5 – Exterior, Environmental & Heavy-Duty Services
  // Relevant for large property owners, HOAs, universities, or commercial facilities
  // ============================================================================
  { name: "Excavation / Earthwork Contractor", tier: "tier5", description: "Land grading, excavation, earthmoving", displayOrder: 41 },
  { name: "Paving / Asphalt Contractor", tier: "tier5", description: "Parking lots, driveways, asphalt paving", displayOrder: 42 },
  { name: "Snow Removal / Deicing Contractor", tier: "tier5", description: "Snow plowing, ice removal, winter maintenance", displayOrder: 43 },
  { name: "Tree Service / Arborist", tier: "tier5", description: "Tree removal, trimming, stump grinding", displayOrder: 44 },
  { name: "Fencing & Gate Automation Specialist", tier: "tier5", description: "Automated gates, security fencing", displayOrder: 45 },
  { name: "Stormwater / Environmental Engineer", tier: "tier5", description: "Drainage systems, environmental compliance", displayOrder: 46 },
  { name: "Waste & Recycling Management", tier: "tier5", description: "Waste removal, recycling programs", displayOrder: 47 },
  { name: "Demolition Contractor", tier: "tier5", description: "Controlled demolition, debris removal", displayOrder: 48 },
  { name: "Restoration Contractor (Fire/Water/Mold)", tier: "tier5", description: "Disaster restoration, remediation", displayOrder: 49 },
  { name: "Pressure Washing / Exterior Cleaning", tier: "tier5", description: "Building cleaning, pressure washing", displayOrder: 50 },

  // ============================================================================
  // TIER 6 – Specialty, Niche & Compliance Fields
  // Typically accessed as needed or for compliance
  // ============================================================================
  { name: "Mold Remediation Specialist", tier: "tier6", description: "Mold testing, removal, prevention", displayOrder: 51 },
  { name: "Lead Paint / Asbestos Abatement Contractor", tier: "tier6", description: "Hazardous material removal, safety compliance", displayOrder: 52 },
  { name: "Radon Mitigation Specialist", tier: "tier6", description: "Radon testing, mitigation systems", displayOrder: 53 },
  { name: "ADA Accessibility Contractor", tier: "tier6", description: "Accessibility compliance, modifications", displayOrder: 54 },
  { name: "Elevator Inspector / Safety Compliance Specialist", tier: "tier6", description: "Elevator inspections, safety certifications", displayOrder: 55 },
  { name: "Environmental Testing (Air, Water, Soil)", tier: "tier6", description: "Environmental quality testing, compliance", displayOrder: 56 },
  { name: "Emergency / Disaster Recovery Contractor", tier: "tier6", description: "Emergency response, disaster recovery", displayOrder: 57 },
  { name: "Energy Efficiency Auditor / Building Envelope Consultant", tier: "tier6", description: "Energy audits, efficiency improvements", displayOrder: 58 },
  { name: "IT Infrastructure / Cabling Contractor", tier: "tier6", description: "Network cabling, IT infrastructure", displayOrder: 59 },
  { name: "Commercial Kitchen / Hood Cleaning Technician", tier: "tier6", description: "Kitchen exhaust cleaning, compliance", displayOrder: 60 },
] as const;
