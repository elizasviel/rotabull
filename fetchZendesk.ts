const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_USER_EMAIL = process.env.ZENDESK_USER_EMAIL;

if (!ZENDESK_API_TOKEN || !ZENDESK_SUBDOMAIN || !ZENDESK_USER_EMAIL) {
  console.error("Missing required environment variables. Exiting.");
  process.exit(1);
}

const baseURL = `https://${ZENDESK_SUBDOMAIN}/api/v2`;
const auth = Buffer.from(
  `${ZENDESK_USER_EMAIL}/token:${ZENDESK_API_TOKEN}`
).toString("base64");

async function fetchTicketComments(ticketId: number) {
  const url = new URL(`${baseURL}/tickets/${ticketId}/comments`);
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

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

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.comments.map((comment: any) => comment.id);
}

async function fetchTickets() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const query = `type:ticket created>${oneYearAgo.toISOString()}`;

  let hasMore = true;
  let afterCursor = null;

  while (hasMore) {
    try {
      const url = new URL(`${baseURL}/search/export`);
      url.searchParams.append("query", query);
      url.searchParams.append("filter[type]", "ticket");
      url.searchParams.append("page[size]", "100");
      if (afterCursor) {
        url.searchParams.append("page[after]", afterCursor);
      }

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

      // Fetch comments for all tickets in parallel
      const commentPromises = results.map(async (ticket: any) => {
        const comments = await fetchTicketComments(ticket.id);
        console.log("Comments for ticket ID:", ticket.id, comments);
      });

      // Wait for all comment fetches to complete
      await Promise.all(commentPromises);

      results.forEach((ticket: any) => {
        console.log(
          `Ticket ID: ${ticket.id}, Created At: ${ticket.created_at}`
        );
      });

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

fetchTickets();
