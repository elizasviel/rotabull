import fetch, { Response } from "node-fetch";
import type { RequestInit } from "node-fetch";
import fs from "fs/promises";
import path from "path";
import pLimit from "p-limit";

const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_USER_EMAIL = process.env.ZENDESK_USER_EMAIL;

if (!ZENDESK_API_TOKEN) {
  console.error("ZENDESK_API_TOKEN environment variable is not set. Exiting.");
  process.exit(1);
}

const MAX_CONCURRENT_REQUESTS = 5;
const RATE_LIMIT_DELAY = 1000;
const MAX_RETRIES = 3;
const BATCH_SIZE = 50;
const BATCH_DELAY = 5000;

const limit = pLimit(MAX_CONCURRENT_REQUESTS);

function getOneYearAgo(): string {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return oneYearAgo.toISOString();
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await sleep(Math.pow(2, MAX_RETRIES - retries) * 1000);
    return retryWithBackoff(fn, retries - 1);
  }
}

async function rateLimitedRequest(
  url: string,
  options: RequestInit
): Promise<Response> {
  await sleep(RATE_LIMIT_DELAY);
  return retryWithBackoff(() => fetch(url, options));
}

async function fetchTicketComments(ticketId: number): Promise<any[]> {
  const url = `https://${ZENDESK_SUBDOMAIN}/api/v2/tickets/${ticketId}/comments.json`;

  try {
    const response = await rateLimitedRequest(url, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${ZENDESK_USER_EMAIL}/token:${ZENDESK_API_TOKEN}`
          ).toString("base64"),
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.comments.map((comment: any) => ({
      plain_body: comment.plain_body,
      author_id: comment.author_id,
    }));
  } catch (error) {
    console.error(`Error fetching comments for ticket ${ticketId}:`, error);
    return [];
  }
}

async function fetchAllTickets(): Promise<any[]> {
  const oneYearAgo = getOneYearAgo();
  let nextPage = `https://${ZENDESK_SUBDOMAIN}/api/v2/tickets.json?created_after=${oneYearAgo}`;
  let allTickets: any[] = [];

  while (nextPage) {
    const response = await rateLimitedRequest(nextPage, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${ZENDESK_USER_EMAIL}/token:${ZENDESK_API_TOKEN}`
          ).toString("base64"),
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    allTickets = allTickets.concat(data.tickets);
    nextPage = data.next_page;
  }

  return allTickets;
}

export async function fetchZendesk() {
  try {
    const tickets = await fetchAllTickets();
    const allComments: { [key: number]: any[] } = {};

    for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
      const batch = tickets.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map((ticket) =>
          limit(async () => {
            try {
              const comments = await fetchTicketComments(ticket.id);
              allComments[ticket.id] = comments;
              console.log(`Comments for ticket ${ticket.id}:`, comments.length);
            } catch (error) {
              console.error(`Error processing ticket ${ticket.id}:`, error);
            }
          })
        )
      );

      if (i + BATCH_SIZE < tickets.length) {
        console.log(
          `Processed ${i + BATCH_SIZE} tickets. Waiting before next batch...`
        );
        await sleep(BATCH_DELAY);
      }
    }

    // Process the data
    const extractedData = Object.entries(allComments).map(
      ([ticketNumber, comments]) => ({
        ticketNumber,
        comments: comments.map((comment: any) => ({
          plain_body: comment.plain_body,
          author_id: comment.author_id,
        })),
      })
    );

    // Write the processed data to a file in the current directory
    const outputPath = path.join(process.cwd(), "zendeskData.json");
    await fs.writeFile(outputPath, JSON.stringify(extractedData, null, 2));

    console.log(`Extracted data has been written to ${outputPath}`);
  } catch (error) {
    console.error("Error in fetchZendesk:", error);
  }
}

fetchZendesk();
