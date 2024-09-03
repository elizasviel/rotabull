import express from "express";
import forge from "./forge/client";
import cors from "cors";
import { startScheduledJobs } from "./scheduledJobs";

interface QuestionResponse {
  suggested_articles: string[];
  suggested_response: string;
}

const app = express();

app.use(express.json());
app.use(cors());

app.post("/suggest", async (req, res) => {
  try {
    const { text_body } = req.body;

    //Take the result of answer 1 and use it as context for answer 2

    // Check against support docs first
    const answer1 = await forge.$withContext(
      "Instructions: Analyze the user query and provide a concise, helpful response. Reference relevant support documentation if applicable. Format your response as a JSON object with 'suggested_articles' (an array of relevant article URLs) and 'suggested_response' (a string) fields. Only fetch relevant article URLs." +
        "IMPORTANT: Your response MUST be a valid JSON object with 'suggested_articles' (an array of strings) and 'suggested_response' (a string) fields. Do not include any text outside of this JSON object." +
        text_body,
      {
        collectionId: "166474b4-a050-4012-88d5-ff16bb6c54f3",
        chunkCount: 15,
      }
    );

    //Then check against the past tickets
    const answer2 = await forge.$withContext(
      "Instructions: Analyze the suggested_response from the previous prompt and improve it by adjusting it based on relevant information from the past ticket data. Reference relevant ticket data if applicable. Format your response as a JSON object with 'suggested_articles' (an array of relevant article URLs) and 'suggested_response' (a string containing the response) fields." +
        "IMPORTANT: Your response MUST be a valid JSON object with 'suggested_articles' (an array of strings) and 'suggested_response' (a string) fields. Do not include any text outside of this JSON object. DO NOT make up any information, you must use the information provided to you. Include the 'suggested_articles' from the provided output." +
        "Provided output: " +
        answer1.response,
      {
        collectionId: "0105d805-655e-4992-8f46-ef7c71043c2d",
        chunkCount: 10,
      }
    );

    let parsedResponse: QuestionResponse;
    try {
      parsedResponse = JSON.parse(answer2.response);
    } catch (parseError) {
      console.error("Unexpected response format from AI:", parseError);
      throw new Error("Unexpected response format from AI");
    }

    if (
      !parsedResponse.suggested_articles ||
      !parsedResponse.suggested_response
    ) {
      throw new Error("Unexpected response format from AI");
    }

    res.json(parsedResponse);
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
