import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import fs from "fs/promises";
import { startScheduledJobs } from "./scheduledJobs";

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

app.use(express.json());
app.use(cors());

// Add this function to estimate tokens more conservatively
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2); // Even more conservative estimate
}

app.post("/suggest", async (req, res) => {
  try {
    const { text_body, subject, requester } = req.body;

    if (!text_body) {
      return res.status(400).json({ error: "text_body is required" });
    }

    const supportDocs = JSON.parse(
      await fs.readFile("supportDocs.json", "utf-8")
    );
    let zendeskData = JSON.parse(
      await fs.readFile("zendeskData.json", "utf-8")
    );

    // Calculate the total tokens of the prompt
    const basePromptTokens =
      estimateTokens(JSON.stringify(supportDocs)) +
      estimateTokens(subject) +
      estimateTokens(requester) +
      estimateTokens(text_body) +
      2000; // Increased buffer for other prompt components

    const maxZendeskDataTokens = 195000 - basePromptTokens; // Reduced max to provide extra safety margin

    // Trim zendeskData if it's too long
    while (
      estimateTokens(JSON.stringify(zendeskData)) > maxZendeskDataTokens &&
      zendeskData.length > 0
    ) {
      zendeskData.pop(); // Remove the last item
    }

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1000,
      temperature: 0.3,
      top_p: 0.9,
      system: `You are a knowledgeable customer support assistant for rotabull. Your task is to provide accurate, helpful, and concise responses to user queries. Use the provided support documentation and past ticket data to inform your answers. Always maintain a professional and friendly tone. If you're unsure about something, it's okay to say so rather than guessing. Prioritize the most relevant information from the support docs and past tickets to address the user's specific query. Your response should be in JSON format with 'suggested_articles' and 'suggested_response' fields.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Support Documentation:" },
            { type: "text", text: JSON.stringify(supportDocs) },
            { type: "text", text: "Past Ticket Data:" },
            { type: "text", text: JSON.stringify(zendeskData) },
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
              text: "Instructions: Analyze the user query and provide a concise, helpful response. Reference relevant support documentation or past ticket data if applicable. Format your response as a JSON object with 'suggested_articles' (an array of relevant article URLs) and 'suggested_response' (a string containing the response) fields.",
            },
          ],
        },
      ],
    });

    let response: QuestionResponse;

    if (msg.content[0].type === "text") {
      const responseText = msg.content[0].text;
      try {
        response = JSON.parse(responseText);
      } catch (parseError) {
        // If parsing fails, attempt to extract information from the text
        console.warn(
          "Failed to parse JSON response. Attempting to extract information."
        );
        const suggestedArticlesMatch = responseText.match(
          /suggested_articles:\s*\[(.*?)\]/s
        );
        const suggestedResponseMatch = responseText.match(
          /suggested_response:\s*"(.*?)"/s
        );

        response = {
          suggested_articles: suggestedArticlesMatch
            ? suggestedArticlesMatch[1]
                .split(",")
                .map((url) => url.trim().replace(/"/g, ""))
            : [],
          suggested_response: suggestedResponseMatch
            ? suggestedResponseMatch[1].replace(/\\n/g, "\n")
            : "Unable to generate a response. Please try again.",
        };
      }
    } else {
      console.error("Unexpected response format from Anthropic API");
      return res
        .status(500)
        .json({ error: "Unexpected response format from AI model" });
    }

    res.json(response);
  } catch (error) {
    console.error("Error in /suggest endpoint:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request" });
  }
});

const PORT = process.env.PORT || 3000;

startScheduledJobs();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
