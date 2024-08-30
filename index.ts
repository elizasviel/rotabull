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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2); //Rough estimate of tokens
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

/*

// constraints -- can't save to local file on disk
// separatte out customer query from response. Double check comment chain
// customers, internal notes, public replies
// rag

//lets implement zendesk and rag

//What can I know about ticket comments?
//I know the "submitter" is always the author of the first comment
//A "submitter" is the person who submitted the ticket
//This could be either an agent or a customer

//We have the author id
//We have "via", which tells us how the ticket was created
//We know if the ticket was public or not (based on the )

//We need to categorize the comments in a useful way
//We need to categorize the comments so that the AI can know which comments are questions and which comments are answers
//The first comment
import { z } from "zod";

const AnnotatedCommentSchema = z.object({
  category: z.enum(["question", "answer", "note"]),
  isSpam: z.boolean(),
  isPublic: z.boolean(),
  sensitiveData: z.boolean(),
  whoIsTheAuthor: z.enum(["support", "customer", "engineer"]),
  body: z.string(),
  via: z.object({
    channel: z.string(),
  }),
  zendeskData: z.record(z.unknown()), // remember to get all the data from zendesk
});

type AnnotatedComment = z.infer<typeof AnnotatedCommentSchema>;

const CommentAnnotationsSchema = z.object({
  typeOfComment: z.enum(["question", "answer", "note"]),
  isSpam: z
    .boolean()
    .describe(
      "true if the comment is spam, useless, or harassment. Most of the time this is false."
    ),
  isPublic: z.boolean(), // and so on.
  sensitiveData: z.boolean(),
});

//do rag on annoted comments in database
//retrieval

const database = [];

// take in a zendesk comment and annotate it
function annotateComment(comment: Comment, prompt?: string) {
  const commentAnnotations = forge.CommentAnnotations.query(
    "please accurately annotate the following comment"
  );
  const annotatedComment = {
    ...commentAnnotations,
    body: comment.body,
    whoIsTheAuthor: whoIsTheAuthor(comment),
    zendeskData: comment,
  };
  return annotatedComment;
}

// question is the zendesk ticket we are generating a response to
// database is the annotated comments we have in the database
// prompt is an additional optional prompt to help generate a useful response
// filtering is for simple, fast filtering of the comments down to a smaller set
// things like: is the comment spam, is the comment public, is the comment a question, is the comment an answer
// this will get us down from 10,000 to maybe 100-1000 comments
function filterRelevantComments(
  question: AnnotatedComment,
  database: AnnotatedComment[],
  prompt?: string
) {
  //filter the database based on the comment
  return database.filter((c) => c.body.includes(comment.body));
}

// OPTIONAL:
// search is EVEN BETTER than retrieval, because it has exact keyword matching.
// but it also sometimes comes up short, because there it might return nothing.
// so we need both
function searchRelevantComments(
  question: AnnotatedComment,
  database: AnnotatedComment[],
  prompt?: string
) {
  // get keywords from the question
  // search the database for comments with those same keywords
}

// retrieval is for more complex filtering of the comments down to an smaller set
// this MIGHT use a vector embedding
// ---> this is easiest, and do it first -- it also might just put all 100-1000 into context and ask for the top 10 along a specific axis
// it also might use a for loop; so for instance it could loop through 10 at a time, and select the most helpful one, and then use a bracket
// or it might loop through all 100 of them and give a score to each one and then select the top 10
function retrieveRelevantComments(
  question: AnnotatedComment,
  database: AnnotatedComment[],
  prompt?: string
) {}

function generateResponses(
  question: AnnotatedComment,
  relevantComments: AnnotatedComment[],
  prompt?: string
) {
  // generate a response to the question four times and return all 4
}

function selectBestResponse(
  question: AnnotatedComment,
  relevantComments: AnnotatedComment[],
  responses: string[],
  prompt?: string
) {
  // select the best response based on the question, the relevant comments, and the prompt
}

*/
