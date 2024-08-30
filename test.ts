import fetch from "node-fetch";

async function testSuggestEndpoint() {
  const url = "http://localhost:3000/suggest";
  const data = {
    subject: "Test Subject",
    requester: "test@example.com",
    text_body: "How do I reset my password?",
    html_body: "<p>How do I reset my password?</p>",
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
    console.log("Suggestion result:", result);
  } catch (error) {
    console.error("Error testing suggest endpoint:", error);
  }
}

testSuggestEndpoint();
