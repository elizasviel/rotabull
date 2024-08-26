import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const msg = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20240620",
  max_tokens: 1000,
  temperature: 0,
  system: "Respond only with short poems.",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Why is the ocean salty?",
        },
      ],
    },
  ],
});
console.log(msg);

const app = express();

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/suggest", (req, res) => {
  const { subject, requester, text_body, html_body } = req.body;
  const suggestion = {
    subject,
    requester,
    text_body,
    html_body,
  };

  // TODO: Call the LLM to get the suggested articles and response

  const suggested_articles = [
    "https://support.rotabull.com/docs/quantum-quote-groups",
    "https://support.rotabull.com/docs/quote-sync",
  ];
  const suggested_response = "Hi John,\nTo resolve your problem with XYZ...";

  res.send({
    suggested_articles,
    suggested_response,
  });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
