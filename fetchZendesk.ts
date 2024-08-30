import fetch, { Response } from "node-fetch";
import type { RequestInit } from "node-fetch";
import pLimit from "p-limit";
import { PrismaClient } from "@prisma/client";

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
const prisma = new PrismaClient();

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

    await prisma.$transaction(
      async (tx) => {
        // Clear existing ZendeskTicket and ZendeskTicketComment entries
        await tx.zendeskTicketComment.deleteMany();
        await tx.zendeskTicket.deleteMany();

        for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
          const batch = tickets.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map((ticket) =>
              limit(async () => {
                try {
                  const comments = await fetchTicketComments(ticket.id);

                  const createdTicket = await tx.zendeskTicket.create({
                    data: {
                      ticketNumber: ticket.id.toString(),
                    },
                  });

                  await tx.zendeskTicketComment.createMany({
                    data: comments.map((comment) => ({
                      plainBody: comment.plain_body,
                      authorId: comment.author_id,
                      zendeskTicketId: createdTicket.id,
                    })),
                  });

                  console.log(
                    `Processed ticket ${ticket.id} with ${comments.length} comments`
                  );
                } catch (error) {
                  console.error(`Error processing ticket ${ticket.id}:`, error);
                }
              })
            )
          );

          if (i + BATCH_SIZE < tickets.length) {
            console.log(
              `Processed ${
                i + BATCH_SIZE
              } tickets. Waiting before next batch...`
            );
            await sleep(BATCH_DELAY);
          }
        }
      },
      {
        timeout: 1200000, // Increase timeout to 1200 seconds
      }
    );

    console.log("Zendesk data has been written to the database");
  } catch (error) {
    console.error("Error in fetchZendesk:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fetchZendesk();
