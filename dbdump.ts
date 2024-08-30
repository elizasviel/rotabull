import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";

//This script dumps the data from the database to a JSON file for debugging and development purposes

const prisma = new PrismaClient();
// Add this helper function to handle BigInt serialization
function replaceBigInt(key: string, value: any) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}
async function exportDataToJson() {
  try {
    // Fetch all data from the tables
    const supportDocs = await prisma.supportDoc.findMany();
    const zendeskTickets = await prisma.zendeskTicket.findMany({
      include: { comments: true },
    });

    // Write data to JSON files
    await fs.writeFile(
      "supportDocs.json",
      JSON.stringify(supportDocs, replaceBigInt, 2)
    );
    await fs.writeFile(
      "zendeskTickets.json",
      JSON.stringify(zendeskTickets, replaceBigInt, 2)
    );

    console.log("Data exported successfully to JSON files.");
  } catch (error) {
    console.error("Error exporting data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

exportDataToJson();
