import { fetchReadme } from "./fetchReadme";
import { fetchTickets } from "./fetchTickets";
import { fetchAndStoreUsers } from "./fetchUsers";

export async function updateSupportData() {
  console.log(`[${new Date().toISOString()}] Starting support data update`);
  try {
    console.log("Fetching and storing users...");

    await Promise.all([
      fetchAndStoreUsers(),
      fetchReadme(),
      fetchTickets(),
    ]).then(() => {
      console.log(
        `[${new Date().toISOString()}] Support data updated successfully`
      );
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error updating support data:`,
      error
    );
  }
}
