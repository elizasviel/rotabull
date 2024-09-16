// Import required modules
import fetch, { Response } from "node-fetch";
import type { RequestInit } from "node-fetch";
import { PrismaClient } from "@prisma/client";
import forge from "./forge/client";

// Set up environment variables
const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_USER_EMAIL = process.env.ZENDESK_USER_EMAIL;

// Check if required environment variables are present
if (!ZENDESK_API_TOKEN || !ZENDESK_SUBDOMAIN || !ZENDESK_USER_EMAIL) {
  console.error("Missing required environment variables. Exiting.");
  process.exit(1);
}

// Initialize Prisma client
const prisma = new PrismaClient();

// Set up Zendesk API base URL and authentication
const baseURL = `https://${ZENDESK_SUBDOMAIN}/api/v2`;
const auth = Buffer.from(
  `${ZENDESK_USER_EMAIL}/token:${ZENDESK_API_TOKEN}`
).toString("base64");

// Function to fetch comments for a specific ticket
async function fetchTicketComments(ticketId: number) {
  const url = new URL(`${baseURL}/tickets/${ticketId}/comments`);
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = parseInt(
      response.headers.get("Retry-After") || "60",
      10
    );
    console.log(
      `Rate limited. Waiting ${retryAfter} seconds before retrying...`
    );
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return fetchTicketComments(ticketId);
  }

  // Check for other HTTP errors
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.comments;
}

// Main function to fetch and process tickets
export async function fetchTickets() {
  // Delete old data
  await forge.$collections.delete("zendeskTicketComment");
  await prisma.forgeTicketCollection.deleteMany();
  await prisma.zendeskTicketComment.deleteMany();
  await prisma.zendeskTicket.deleteMany();

  // Create a new collection in Forge
  const collection = await forge.$collections.create({
    name: "zendeskTicketComment",
  });

  // Add a reference to the postgres db
  await prisma.forgeTicketCollection.create({
    data: {
      forgeId: collection.id,
      name: collection.name,
      lastUpdated: new Date().toISOString(),
    },
  });

  // Get all user IDs with @rotabull.com email
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

  // Set up query to fetch tickets from the last year
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const query = `type:ticket created>${oneYearAgo.toISOString()}`;

  let hasMore = true;
  let afterCursor = null;

  // Fetch tickets in batches
  while (hasMore) {
    try {
      // Set up URL for ticket search
      const url = new URL(`${baseURL}/search/export`);
      url.searchParams.append("query", query);
      url.searchParams.append("filter[type]", "ticket");
      url.searchParams.append("page[size]", "100");
      if (afterCursor) {
        url.searchParams.append("page[after]", afterCursor);
      }

      // Fetch tickets
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const { results, meta, links } = data;

      // Process tickets in parallel
      const ticketPromises = results.map(async (ticket: any) => {
        const comments = await fetchTicketComments(ticket.id);

        // Annotate comments
        const annotatedComments = comments.map((comment: any) => {
          let plainBody = comment.plain_body;
          if (userIds.includes(comment.author_id)) {
            plainBody = "ROTABULL TEAM COMMENT\n\n" + plainBody;
          }
          if (!comment.public) {
            plainBody = "INTERNAL NOTE\n\n" + plainBody;
          } else {
            plainBody = "PUBLIC COMMENT\n\n" + plainBody;
          }
          return { ...comment, plain_body: plainBody };
        });

        // Save ticket and comments to database
        await prisma.$transaction(async (tx) => {
          const createdTicket = await tx.zendeskTicket.create({
            data: {
              ticketNumber: ticket.id.toString(),
              submitterId: BigInt(ticket.submitter_id),
              created_at: ticket.created_at,
            },
          });

          await tx.zendeskTicketComment.createMany({
            data: annotatedComments.map((comment: any) => ({
              plainBody: comment.plain_body,
              authorId: BigInt(comment.author_id),
              zendeskTicketId: createdTicket.id,
              public: comment.public,
              created_at: comment.created_at,
            })),
          });
        });

        // Upload comments to Forge
        await forge.$documents.create({
          name: ticket.id.toString(),
          text: JSON.stringify(annotatedComments),
          collectionIds: [collection.id],
        });
        console.log("CREATED DOCUMENT IN FORGE", ticket.id);

        console.log("Comments for ticket ID:", ticket.id, comments.length);
      });

      // Wait for all ticket processing to complete
      await Promise.all(ticketPromises);

      // Log processed tickets
      results.forEach((ticket: any) => {
        console.log(
          `Ticket ID: ${ticket.id}, Created At: ${ticket.created_at}`
        );
      });

      // Update pagination info
      hasMore = meta.has_more;
      afterCursor = meta.after_cursor;

      if (!links.next) {
        hasMore = false;
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
      hasMore = false;
    }
  }
}
