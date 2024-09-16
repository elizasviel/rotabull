import { updateSupportData } from "./scheduledJobs";

export const handler = async (event: any, context: any) => {
  console.log("Scheduled job started");
  try {
    await updateSupportData();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Scheduled job completed successfully" }),
    };
  } catch (error) {
    console.error("Error in scheduled job:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error in scheduled job execution" }),
    };
  }
};
