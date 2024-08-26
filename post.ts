fetch("http://localhost:3000/suggest", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    subject: "Email RFQs",
    requester: "John Doe",
    text_body:
      "Hi Rotabull team, I noticed that some inbound emails are not being loaded as RFQs. Can you help me with that?",
    html_body:
      "<p>Hi Rotabull team, I noticed that some inbound emails are not being loaded as RFQs. Can you help me with that?</p>",
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));
