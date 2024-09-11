import fetch from "node-fetch";
import fs from "fs/promises";

async function getRandomPlainBody() {
  const data = JSON.parse(await fs.readFile("zendeskData.json", "utf-8"));
  const tickets = Object.values(data);
  const randomTicket = tickets[
    Math.floor(Math.random() * tickets.length)
  ] as any;
  const plainBodies = randomTicket.plainBodies;
  return plainBodies[0] || "No plain body available";
}

async function testSuggestEndpoint() {
  const url = "http://localhost:3000/suggest";

  for (let i = 0; i < 10; i++) {
    const plainBody = await getRandomPlainBody();
    const data = {
      subject: "Test Subject",
      requester: "test@example.com",
      text_body: plainBody,
      html_body: plainBody,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`Test ${i + 1} query:`, plainBody.slice(0, 100) + "...");
      console.log(`Test ${i + 1} result:`, result);
    } catch (error) {
      console.error(`Error in test ${i + 1}:`, error);
    }
  }
}

testSuggestEndpoint();
