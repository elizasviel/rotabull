import fetch from "node-fetch";
import zendeskData from "./zendeskData.json";

const API_URL = `http://localhost:3000/suggest`; // Update this with your actual API URL

//Picks a random ticket from the zendeskData array and tests the endpoint with it

function getRandomSample(arr: any[], n: number) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testEndpoint(
  subject: string,
  requester: string,
  text_body: string,
  retries = 3,
  delayMs = 1000
) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject, requester, text_body }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log(`Rate limited. Retrying in ${delayMs}ms...`);
          await delay(delayMs);
          continue;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Response:", data);
      return data;
    } catch (error) {
      console.error(`Error (attempt ${i + 1}/${retries}):`, error);
      if (i === retries - 1) throw error;
      await delay(delayMs);
    }
  }
}

async function runTests() {
  // Ensure zendeskData is an array
  const zendeskDataArray = Array.isArray(zendeskData)
    ? zendeskData
    : Object.values(zendeskData);

  const sampleTickets = getRandomSample(zendeskDataArray, 1);

  for (const ticket of sampleTickets) {
    const subject = `Test Subject for Ticket ${ticket.ticketNumber}`;
    const requester = `requester${ticket.ticketNumber}@example.com`;
    const text_body = ticket.plainBodies[0] || "No plain body available";

    console.log(`Testing with Ticket ${ticket.ticketNumber}`);
    try {
      await testEndpoint(subject, requester, text_body);
    } catch (error) {
      console.error(`Failed to process ticket ${ticket.ticketNumber}:`, error);
    }
    console.log("---");
    await delay(240000); // Adds a 4-minute delay between requests to avoid rate limiting
  }
}

runTests();
