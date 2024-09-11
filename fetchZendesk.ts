import fetch, { Response } from "node-fetch";
import type { RequestInit } from "node-fetch";
import { PrismaClient } from "@prisma/client";
import forge from "./forge/client";

const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_USER_EMAIL = process.env.ZENDESK_USER_EMAIL;

if (!ZENDESK_API_TOKEN) {
  console.error("ZENDESK_API_TOKEN environment variable is not set. Exiting.");
  process.exit(1);
}

const RATE_LIMIT_DELAY = 1000;
const MAX_RETRIES = 3;
const prisma = new PrismaClient();

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

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      console.log(`Rate limited. Retrying after ${retryAfter} seconds.`);
      await sleep(parseInt(retryAfter || "60") * 1000);
      return fetchTicketComments(ticketId);
    } else if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return data.comments.map((comment: any) => ({
      plain_body: comment.plain_body,
      author_id: comment.author_id,
      public: comment.public,
      created_at: comment.created_at,
    }));
  } catch (error) {
    console.error(`Error fetching comments for ticket ${ticketId}:`, error);
    return [];
  }
}

async function fetchAllTickets(): Promise<any[]> {
  const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
  let startTime = oneYearAgo.toString();
  let allTickets: any[] = [];

  while (true) {
    const url = `https://${ZENDESK_SUBDOMAIN}/api/v2/incremental/tickets.json?start_time=${startTime}&per_page=100`;

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

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get("Retry-After") || "60"
        );
        console.log(`Rate limited. Retrying after ${retryAfter} seconds.`);
        await sleep(retryAfter * 1000);
        continue; // Retry the same request without changing startTime
      } else if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("DATA", data);
      // Filter out deleted tickets
      const nonDeletedTickets = data.tickets.filter(
        (ticket: any) => ticket.status !== "deleted"
      );
      allTickets = allTickets.concat(nonDeletedTickets);

      console.log(`Fetched ${data.count} tickets. Total: ${allTickets.length}`);

      if (data.end_of_stream) {
        break; // No more pages to fetch
      }

      startTime = data.end_time;
    } catch (error) {
      console.error("Error fetching tickets:", error);
      await sleep(5000); // Wait for 5 seconds before retrying
    }
  }

  return allTickets;
}

export async function fetchZendesk() {
  try {
    //Delete the old collection in Forge and postgres db
    await forge.$collections.delete("zendeskTicketComment");
    await prisma.forgeTicketCollection.deleteMany();

    //create a new collection in Forge
    const collection = await forge.$collections.create({
      name: "zendeskTicketComment",
    });

    //Whenever I fetchZendesk, I want to create a new collection in Forge
    await prisma.forgeTicketCollection.create({
      data: {
        forgeId: collection.id,
        name: collection.name,
        lastUpdated: new Date().toISOString(),
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

    //Remove duplicates from the tickets array
    const uniqueTickets = tickets.filter(
      (ticket, index, self) =>
        index === self.findIndex((t) => t.id === ticket.id)
    );
    console.log("UNIQUE TICKETS", uniqueTickets.length);
    console.log(
      "Ticket IDs:",
      uniqueTickets.map((ticket) => ({
        id: ticket.id,
      }))
    );

    // Clear existing ZendeskTicket and ZendeskTicketComment entries
    await prisma.zendeskTicketComment.deleteMany();
    await prisma.zendeskTicket.deleteMany();

    // Process tickets in batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < uniqueTickets.length; i += BATCH_SIZE) {
      const ticketBatch = uniqueTickets.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(
        async (tx) => {
          for (const ticket of ticketBatch) {
            const comments = await fetchTicketComments(ticket.id);
            console.log("FETCHED TICKET COMMENTS", ticket.id);

            //Annotate each comment
            comments.forEach((comment: any) => {
              if (userIds.includes(comment.author_id)) {
                comment.plain_body =
                  "ROTABULL TEAM COMMENT\n\n" + comment.plain_body;
              }
              if (!comment.public) {
                comment.plain_body = "INTERNAL NOTE\n\n" + comment.plain_body;
              } else {
                comment.plain_body = "PUBLIC COMMENT\n\n" + comment.plain_body;
              }
            });

            //Upload the comments to Forge
            await forge.$documents.create({
              name: ticket.id.toString(),
              text: JSON.stringify(comments),
              collectionIds: [collection.id],
            });
            console.log("CREATED DOCUMENT IN FORGE", ticket.id);

            try {
              const createdTicket = await tx.zendeskTicket.create({
                data: {
                  ticketNumber: ticket.id.toString(),
                  submitterId: BigInt(ticket.submitter_id),
                  created_at: ticket.created_at,
                },
              });

              await tx.zendeskTicketComment.createMany({
                data: comments.map((comment) => ({
                  plainBody: comment.plain_body,
                  authorId: BigInt(comment.author_id),
                  zendeskTicketId: createdTicket.id,
                  public: comment.public,
                  created_at: comment.created_at,
                })),
              });

              console.log(
                `Processed ticket ${ticket.id} with ${comments.length} comments`
              );
            } catch (error) {
              console.error(`Error processing ticket ${ticket.id}:`, error);
            }
          }
        },
        {
          timeout: 9000000, // Increase timeout to 15 minutes
        }
      );

      console.log(`Processed batch of ${ticketBatch.length} tickets`);
    }
  } catch (error) {
    console.error("Error in fetchZendesk:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fetchZendesk();
