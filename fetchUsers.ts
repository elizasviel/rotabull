import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();
const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_USER_EMAIL = process.env.ZENDESK_USER_EMAIL;

interface User {
  id: string; // Changed to string to handle BigInt
  email: string | null; // Made email optional
  role: string;
  active: boolean;
}

interface ZendeskResponse {
  users: User[];
  next_page: string | null;
}

//There appears to not be any deleted or permanently deleted users
async function fetchAndStoreUsers(): Promise<void> {
  const url = `https://${ZENDESK_SUBDOMAIN}/api/v2/users.json?include=deleted,permanently_deleted`;
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

      for (const user of data.users) {
        await prisma.zendeskUser.upsert({
          where: { id: BigInt(user.id) },
          update: {
            email: user.email || "",
            role: user.role,
            active: user.active,
          },
          create: {
            id: BigInt(user.id),
            email: user.email || "",
            role: user.role,
            active: user.active,
          },
        });
      }

      nextPage = data.next_page;
    }

    console.log("All Zendesk users have been stored in the database.");
  } catch (error) {
    console.error("Error fetching and storing user data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

export { fetchAndStoreUsers };

fetchAndStoreUsers();
