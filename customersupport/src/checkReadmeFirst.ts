import express from "express";
import forge from "../forge/client";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { fetchReadme } from "./fetchReadme";
import { fetchTickets } from "./fetchTickets";
import { fetchAndStoreUsers } from "./fetchUsers";

const app = express();

const prisma = new PrismaClient();

app.use(express.json());
app.use(cors());

app.get("/triggerManualJob", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Transfer-Encoding": "chunked",
  });

  const sendHeartbeat = () => {
    res.write("\n");
  };

  const heartbeat = setInterval(sendHeartbeat, 5000);

  try {
    await Promise.all([fetchAndStoreUsers(), fetchReadme(), fetchTickets()]);
    clearInterval(heartbeat);
    const response = JSON.stringify({
      message: "Manual job triggered successfully",
    });
    res.write(response);
    res.end();
  } catch (error) {
    clearInterval(heartbeat);
    console.error("Error in /triggerManualJob endpoint:", error);
    const errorResponse = JSON.stringify({
      error: "An error occurred while triggering the manual job",
    });
    res.write(errorResponse);
    res.end();
  }
});

app.post("/suggest", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Transfer-Encoding": "chunked",
  });

  const sendHeartbeat = () => {
    res.write("\n");
  };

  const heartbeat = setInterval(sendHeartbeat, 5000);

  try {
    const { text_body } = req.body;
    console.log("TEXT BODY", text_body);
    const allSlugs = await prisma.supportDoc.findMany({
      select: {
        slug: true,
      },
    });

    // Check against support docs first
    const slug1 = await forge.$withContext(
      "Here are all the URL slugs of existing Rotabull support articles: " +
        allSlugs.map((slug) => slug.slug).join(", ") +
        ". Return the URL slug of the support article most relevant to the following customer query. Return only the slug and nothing else." +
        "Customer Query: " +
        text_body,
      {
        collectionId: "57ff8337-6d12-416a-802b-e6cedfb3c7ec",
        chunkCount: 15,
      }
    );

    console.log("slug1", slug1.response);

    const slug2 = await forge.$withContext(
      `Here are all the URL slugs of existing Rotabull support articles: ` +
        allSlugs.map((slug) => slug.slug).join(", ") +
        `Here is a customer query: ${text_body}` +
        `Here is the URL slug of the Rotabull support article most relevant to the customer query: ${slug1.response}.` +
        `Return a different URL slug of the support article second most relevant to the customer query. Return only the slug and nothing else.`,
      {
        collectionId: "57ff8337-6d12-416a-802b-e6cedfb3c7ec",
        chunkCount: 15,
      }
    );

    console.log("slug2", slug2.response);

    const responseText1 = await forge.$withContext(
      `You are a customer support agent for Rotabull, a modern system for aerospace part sellers & buyers. You are given the following two support articles and a customer query.` +
        `ARTICLE 1 URL: https://support.rotabull.com/docs/${slug1.response}` +
        `ARTICLE 2 URL: https://support.rotabull.com/docs/${slug2.response}` +
        `CUSTOMER QUERY: ${text_body}` +
        `Please respond to the customer query based on the provided support articles. Reply with only the response text and nothing else.` +
        `RESPONSE: `,
      {
        collectionId: "57ff8337-6d12-416a-802b-e6cedfb3c7ec",
        chunkCount: 10,
      }
    );

    console.log("responseText1", responseText1.response);

    const responseText2 = await forge.$withContext(
      `You are a customer support agent for Rotabull, a modern system for aerospace part sellers & buyers. You are given the following customer query and a suggested response to the customer query.` +
        `CUSTOMER QUERY: ${text_body}` +
        `SUGGESTED RESPONSE: ${responseText1.response}` +
        `Please use the provided Zendesk ticket comment data to improve the suggested response to the customer query. Reply with only the improved suggested response and nothing else.` +
        `RESPONSE: `,
      {
        collectionId: "908169b2-84a3-46bf-82a2-f1963154884a",
        chunkCount: 10,
      }
    );

    console.log("responseText2", responseText2.response);

    clearInterval(heartbeat);
    const response = JSON.stringify({
      suggested_articles: [
        "https://support.rotabull.com/docs/" + slug1.response,
        "https://support.rotabull.com/docs/" + slug2.response,
      ],
      suggested_response: responseText2.response,
    });
    res.write(response);
    res.end();
  } catch (error) {
    clearInterval(heartbeat);
    console.error("Error in /suggest endpoint:", error);
    const errorResponse = JSON.stringify({
      error: "An error occurred while processing your request",
    });
    res.write(errorResponse);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app };
