import fetch, { Response } from "node-fetch";

const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;
const ZENDESK_SUBDOMAIN = "rotabullsupport.zendesk.com";
const ZENDESK_USER_EMAIL = "evan@rotabull.com";

if (!ZENDESK_API_TOKEN) {
  console.error("ZENDESK_API_TOKEN environment variable is not set. Exiting.");
  process.exit(1);
}

const url = `https://${ZENDESK_SUBDOMAIN}/api/v2/groups.json`;

interface ZendeskGroup {
  id: number;
  name: string;
  // Add other properties as needed
}

interface ZendeskResponse {
  groups: ZendeskGroup[];
}

fetch(url, {
  headers: {
    Authorization:
      "Basic " +
      Buffer.from(`${ZENDESK_USER_EMAIL}/token:${ZENDESK_API_TOKEN}`).toString(
        "base64"
      ),
    "Content-Type": "application/json",
  },
})
  .then((response: Response) => {
    if (response.status !== 200) {
      console.error(
        `Status: ${response.status}, Problem with the request. Exiting.`
      );
      process.exit(1);
    }
    return response.json();
  })
  .then((data: ZendeskResponse) => {
    console.log("First group = ", data.groups[0].name);

    data.groups.forEach((group) => {
      console.log(group.name);
    });
  })
  .catch((error: Error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
