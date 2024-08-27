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

//handle post requests to /suggest
app.post("/suggest", async (req, res) => {
  try {
    const { text_body } = req.body;

    if (!text_body) {
      return res.status(400).json({ error: "text_body is required" });
    }

    // Load stored support documentation and Zendesk data
    const supportDocs = JSON.parse(
      await fs.readFile("supportDocs.json", "utf-8")
    );
    const zendeskData = JSON.parse(
      await fs.readFile("zendeskData.json", "utf-8")
    );

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1000,
      temperature: 0,
      system:
        "You are a helpful customer support assistant. Use the provided support documentation and past ticket data to answer user queries.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Support Documentation:\n\n${supportDocs}\n\nPast Ticket Data:\n\n${zendeskData}\n\nUser Query:\n${text_body}`,
            },
          ],
        },
      ],
    });

    const suggested_response = msg.content
      .filter(
        (block): block is { type: "text"; text: string } =>
          block.type === "text"
      )
      .map((block) => block.text)
      .join("\n");

    res.json({
      suggested_response,
    });
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

//automation rules and autoquoting??
