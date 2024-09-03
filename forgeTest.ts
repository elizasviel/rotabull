import forge from "./forge/client";

//Take the result of answer 1 and use it as context for answer 2
const email = `
      "<p>Hello, Were having trouble with our ILS integration. We have had many requests via ILS, but they haven't been showing up in Rotabull for at least a week. Do you have any idea why this might be happening? I think that we may be logged into the account elsewhere. Should Rotabull be able to use the same account that we use manually to access the ILS API? Or is there some other reason that we're not seeing our ILS data in Rotabull? Thanks, ~Richard</p>",
`;

// Check against support docs first
const answer1 = await forge.$withContext(
  "Instructions: Analyze the user query and provide a concise, helpful response. Reference relevant support documentation if applicable. Format your response as a JSON object with 'suggested_articles' (an array of relevant article URLs) and 'suggested_response' (a string) fields. Only fetch relevant article URLs." +
    "IMPORTANT: Your response MUST be a valid JSON object with 'suggested_articles' (an array of strings) and 'suggested_response' (a string) fields. Do not include any text outside of this JSON object." +
    email,
  {
    collectionId: "166474b4-a050-4012-88d5-ff16bb6c54f3",
    chunkCount: 15,
  }
);

//Then check against the past tickets
const answer2 = await forge.$withContext(
  "Instructions: Analyze the suggested_response from the previous prompt and improve it by adjusting it based on relevant information from the past ticket data. Reference relevant ticket data if applicable. Format your response as a JSON object with 'suggested_articles' (an array of relevant article URLs) and 'suggested_response' (a string containing the response) fields." +
    "IMPORTANT: Your response MUST be a valid JSON object with 'suggested_articles' (an array of strings) and 'suggested_response' (a string) fields. Do not include any text outside of this JSON object. DO NOT make up any information, you must use the information provided to you. Include the 'suggested_articles' from the provided output." +
    email +
    "Provided output: " +
    answer1.response,
  {
    collectionId: "0105d805-655e-4992-8f46-ef7c71043c2d",
    chunkCount: 10,
  }
);

console.log(answer1.response);
console.log(answer2.response);
