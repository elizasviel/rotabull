import fetch from "node-fetch";

const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_USER_EMAIL = process.env.ZENDESK_USER_EMAIL;

interface User {
  id: number;
  email: string;
  role: string;
  active: boolean;
}

interface ZendeskResponse {
  users: User[];
  next_page: string | null;
}

/*
https://developer.zendesk.com/api-reference/ticketing/users/users/#list-users
Possible values for role are "end-user", "agent", or "admin".
Fetches all agent and admin users.
*/

async function getAllAgentIds(): Promise<number[]> {
  const url = `https://${ZENDESK_SUBDOMAIN}/api/v2/users.json?role[]=agent&role[]=admin`;
  const allAgentIds: number[] = [];
  let nextPage: string | null = url;

  try {
    while (nextPage) {
      const response = await fetch(nextPage, {
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

      const data: ZendeskResponse = await response.json();
      data.users.forEach((user: User) => {
        allAgentIds.push(user.id);
      });

      nextPage = data.next_page;
    }

    return allAgentIds;
  } catch (error) {
    console.error("Error fetching agent IDs:", error);
    return [];
  }
}

getAllAgentIds().then((agentIds) => {
  console.log("All agent IDs:", agentIds);
});
