import cron from "node-cron";
import { fetchReadme } from "./fetchReadme";
import { fetchZendesk } from "./fetchZendesk";

//This script runs every Sunday at 00:00 to update the support data from Zendesk and Readme.

async function updateSupportData() {
  try {
    await fetchReadme();
    await fetchZendesk();

    console.log("Support data updated successfully");
  } catch (error) {
    console.error("Error updating support data:", error);
  }
}

export function startScheduledJobs() {
  cron.schedule("0 0 * * 0", updateSupportData);
}
