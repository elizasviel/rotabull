import fetch, { Response } from "node-fetch";
import type { RequestInit } from "node-fetch";

const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_USER_EMAIL = process.env.ZENDESK_USER_EMAIL;

const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY = 1000;

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

interface User {
  id: number;
  email: string;
  role: string;
  active: boolean;
}

async function getAllAgentIds(): Promise<number[]> {
  const url = `https://${ZENDESK_SUBDOMAIN}/api/v2/users.json?role[]=agent&role[]=admin`;
  const allAgentIds: number[] = [];
  let nextPage: string | null = url;

  try {
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
