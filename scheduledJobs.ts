import cron from "node-cron";
import { fetchReadme } from "./fetchReadme";
import { fetchTickets } from "./fetchTickets";
import { fetchAndStoreUsers } from "./fetchUsers";

async function updateSupportData() {
  console.log(`[${new Date().toISOString()}] Starting support data update`);
  try {
    console.log("Fetching and storing users...");
    //always fetch users first
    await fetchAndStoreUsers();
    console.log("Fetching Readme data...");
    await fetchReadme();
    console.log("Fetching Zendesk data...");
    await fetchTickets();

    console.log(
      `[${new Date().toISOString()}] Support data updated successfully`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error updating support data:`,
      error
    );
  }
}

export function startScheduledJobs() {
  // Run every minute for testing purposes
  // cron.schedule("* * * * *", updateSupportData);

  // Weekly schedule
  cron.schedule("0 0 * * 0", updateSupportData);

  console.log("Scheduled jobs started");
}
