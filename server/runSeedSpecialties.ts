import { db } from "./db";
import { contractorSpecialties } from "@shared/schema";
import { contractorSpecialtiesSeedData } from "./seedContractorSpecialties";

async function seedContractorSpecialties() {
  console.log("🌱 Seeding contractor specialties...");
  
  try {
    // Insert all contractor specialties
    const result = await db.insert(contractorSpecialties).values(contractorSpecialtiesSeedData).onConflictDoNothing();
    
    console.log(`✅ Seeded ${contractorSpecialtiesSeedData.length} contractor specialties successfully!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding contractor specialties:", error);
    process.exit(1);
  }
}

seedContractorSpecialties();
