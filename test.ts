import fetch from "node-fetch";

async function testSuggestEndpoint() {
  const url = "http://localhost:3000/suggest";
  const data = {
    subject: "Test Subject",
    requester: "test@example.com",
    text_body: "ILS integration not working",
    html_body:
      "<p>Hello, Were having trouble with our ILS integration. We have had many requests via ILS, but they haven't been showing up in Rotabull for at least a week. Do you have any idea why this might be happening? I think that we may be logged into the account elsewhere. Should Rotabull be able to use the same account that we use manually to access the ILS API? Or is there some other reason that we're not seeing our ILS data in Rotabull? Thanks, ~Richard</p>",
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
