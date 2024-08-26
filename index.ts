import express from "express";
import { prepareDataForClaude } from "./generatePrompt";
import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";

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

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/suggest", async (req, res) => {
  try {
    const { subject, requester, text_body, html_body } = req.body;

    if (!text_body) {
      return res.status(400).json({ error: "text_body is required" });
    }

    const supportDocs = await prepareDataForClaude();

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1000,
      temperature: 0,
      system:
        "You are a helpful customer support assistant. Use the provided support documentation to answer user queries.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Support Documentation:\n\n${supportDocs}\n\nUser Query:\n${text_body}`,
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

    // const suggested_articles = extractRelevantArticles(
    //   supportDocs,
    //   suggested_response
    // );

    res.json({
      //suggested_articles,
      suggested_response,
    });
  } catch (error) {
    console.error("Error in /suggest endpoint:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request" });
  }
});

function extractRelevantArticles(
  supportDocs: string,
  response: string
): string[] {
  const documents = supportDocs.split("---").map((doc) => {
    const [header, content] = doc.split("\n\nContent:\n");
    const slug = header.replace("Document: ", "").trim();
    return { slug, content };
  });

  const relevantDocs = documents.filter(
    (doc) =>
      response.toLowerCase().includes(doc.slug.toLowerCase()) ||
      doc.content.toLowerCase().includes(response.toLowerCase())
  );

  return relevantDocs.map(
    (doc) => `https://support.rotabull.com/docs/${doc.slug}`
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
