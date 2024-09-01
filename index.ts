import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import { startScheduledJobs } from "./scheduledJobs";
import { PrismaClient } from "@prisma/client";

interface Question {
  subject: string;
  requester: string;
  text_body: string;
  html_body: string;
}

interface QuestionResponse {
  suggested_articles: string[];
  suggested_response: string;
}

const anthropic = new Anthropic();
const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cors());

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2); //Rough estimate of tokens
}

function safeStringify(obj: any): string {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

async function fetchAgentIds() {
  const agents = await prisma.zendeskUser.findMany({
    select: { id: true },
  });
  return new Set(agents.map((user) => BigInt(user.id)));
}

const supportDocs = await prisma.supportDoc.findMany();
let zendeskData = await prisma.zendeskTicket.findMany({
  include: {
    comments: true,
  },
});

app.post("/suggest", async (req, res) => {
  try {
    const { text_body, subject, requester } = req.body;

    if (!text_body) {
      return res.status(400).json({ error: "text_body is required" });
    }

    const agentIds = await fetchAgentIds();

    // Calculate the total tokens of the prompt
    const basePromptTokens =
      estimateTokens(safeStringify(supportDocs)) +
      estimateTokens(subject) +
      estimateTokens(requester) +
      estimateTokens(text_body) +
      2000; // Increased buffer for other prompt components

    const maxZendeskDataTokens = 145000 - basePromptTokens; // Reduced max to provide extra safety margin

    // Trim zendeskData if it's too long
    while (
      estimateTokens(safeStringify(zendeskData)) > maxZendeskDataTokens &&
      zendeskData.length > 0
    ) {
      zendeskData.pop(); // Remove the last item
    }

    // Categorize comments
    const categorizedZendeskData = zendeskData.map((ticket) => ({
      ...ticket,
      comments: ticket.comments.map((comment) => ({
        ...comment,
        isTeamComment: agentIds.has(BigInt(comment.authorId)),
      })),
    }));

    console.log("Preparing to call Anthropic API with data:");
    console.log("Support Docs Length:", supportDocs.length);
    console.log("Zendesk Data Length:", categorizedZendeskData.length);
    console.log("Subject:", subject);
    console.log("Requester:", requester);
    console.log("Text Body Length:", text_body.length);

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1000,
      temperature: 0.3,
      top_p: 0.9,
      system: `You are a knowledgeable customer support assistant for rotabull. Your task is to provide accurate, helpful, and concise responses to user queries. Use the provided support documentation and past ticket data to inform your answers. Always maintain a professional and friendly tone. If you're unsure about something, it's okay to say so rather than guessing. Prioritize the most relevant information from the support docs and past tickets to address the user's specific query. Pay attention to whether comments are from the team or external sources. Your response should be in JSON format with 'suggested_articles' and 'suggested_response' fields.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Support Documentation:" },
            { type: "text", text: safeStringify(supportDocs) },
            { type: "text", text: "Past Ticket Data:" },
            { type: "text", text: safeStringify(categorizedZendeskData) },
            { type: "text", text: `Subject: ${subject}` },
            { type: "text", text: `Requester: ${requester}` },
            { type: "text", text: "User Query:" },
            { type: "text", text: text_body },
            {
              type: "text",
              text: "IMPORTANT: Your response MUST be a valid JSON object with 'suggested_articles' (an array of strings) and 'suggested_response' (a string) fields. Do not include any text outside of this JSON object.",
            },
            {
              type: "text",
              text: "Instructions: Analyze the user query and provide a concise, helpful response. Reference relevant support documentation or past ticket data if applicable. Pay special attention to comments marked as 'isTeamComment: true' as these are from the support team. Format your response as a JSON object with 'suggested_articles' (an array of relevant article URLs) and 'suggested_response' (a string containing the response) fields.",
            },
          ],
        },
      ],
    });

    console.log("Received response from Anthropic API:", msg);

    if (msg.content[0].type === "text") {
      res.json(msg.content[0].text);
    } else {
      console.error("Unexpected response format from Anthropic API");
      return res
        .status(500)
        .json({ error: "Unexpected response format from AI model" });
    }
  } catch (error) {
    console.error("Error in /suggest endpoint:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request" });
  }
});

const PORT = process.env.PORT || 3000;

//startScheduledJobs();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit();
});
