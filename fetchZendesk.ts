import fetch, { Response } from "node-fetch";
import type { RequestInit } from "node-fetch";
import pLimit from "p-limit";
import { PrismaClient } from "@prisma/client";
import forge from "./forge/client";

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
    const response = await retryWithBackoff(() =>
      rateLimitedRequest(url, {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${ZENDESK_USER_EMAIL}/token:${ZENDESK_API_TOKEN}`
            ).toString("base64"),
          "Content-Type": "application/json",
        },
      })
    );

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        console.log(`Rate limited. Retrying after ${retryAfter} seconds.`);
        await sleep(parseInt(retryAfter || "60") * 1000);
        return fetchTicketComments(ticketId);
      }
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
  let nextPage = `https://${ZENDESK_SUBDOMAIN}/api/v2/tickets.json?created_after=${oneYearAgo}&per_page=100`;
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

    console.log(`Fetched ${allTickets.length} tickets so far...`);
  }

  return allTickets;
}

export async function fetchZendesk() {
  try {
    //Delete the old collection in Forge and postgres db
    await forge.$collections.delete("zendeskTicketComment1");
    await prisma.forgeTicketCollection.deleteMany();

    //create a new collection in Forge
    const collection = await forge.$collections.create({
      name: "zendeskTicketComment1",
    });

    //Whenever I fetchZendesk, I want to create a new collection in Forge
    await prisma.forgeTicketCollection.create({
      data: {
        forgeId: collection.id,
        name: collection.name,
      },
    });

    //Next, get all the user IDs that have an email that ends with @rotabull.com
    const userIds = (
      await prisma.zendeskUser.findMany({
        where: {
          email: {
            endsWith: "@rotabull.com",
          },
        },
        select: {
          id: true,
        },
      })
    ).map((user) => user.id);

    console.log("User IDs:", userIds);

    //Fetch all the tickets
    const tickets = await fetchAllTickets();

    // Clear existing ZendeskTicket and ZendeskTicketComment entries
    await prisma.zendeskTicketComment.deleteMany();
    await prisma.zendeskTicket.deleteMany();

    //Perform operations on each ticket
    for (const ticket of tickets) {
      //First, fetch the array of comments for each ticket
      const comments = await fetchTicketComments(ticket.id);
      console.log("FETCHED TICKET COMMENTS", ticket.id);

      //Next, annotate each comment by adding a prefix if the author ID is in the userIds array
      comments.forEach((comment: any) => {
        if (userIds.includes(comment.author_id)) {
          comment.plain_body = "ROTABULL TEAM COMMENT\n\n" + comment.plain_body;
        }
      });

      //Then, upload the array of comments as a single document in Forge
      await forge.$documents.create({
        name: ticket.id.toString(),
        text: JSON.stringify(comments),
        collectionIds: [collection.id],
      });
      console.log("CREATED DOCUMENT IN FORGE", ticket.id);

      //Finally, write the ticket and comment info to the postgres db
      await prisma.$transaction(async (tx) => {
        try {
          //Create the ticket
          const createdTicket = await tx.zendeskTicket.create({
            data: {
              ticketNumber: ticket.id.toString(),
              submitterId: BigInt(ticket.submitter_id),
            },
          });

          //Create the comments
          await tx.zendeskTicketComment.createMany({
            data: comments.map((comment) => ({
              plainBody: comment.plain_body,
              authorId: BigInt(comment.author_id),
              zendeskTicketId: createdTicket.id,
            })),
          });

          console.log(
            `Processed ticket ${ticket.id} with ${comments.length} comments`
          );
        } catch (error) {
          console.error(`Error processing ticket ${ticket.id}:`, error);
        }
      });
    }
  } catch (error) {
    console.error("Error in fetchZendesk:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fetchZendesk();
