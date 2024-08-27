import cron from "node-cron";
import { fetchReadme } from "./fetchReadme";
import { fetchZendesk } from "./fetchZendesk";

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
  // Run every Sunday at 00:00
  cron.schedule("0 0 * * 0", updateSupportData);
}
