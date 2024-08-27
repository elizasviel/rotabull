//example post request

fetch("http://localhost:3000/suggest", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    subject: "Email RFQs",
    requester: "John Doe",
    text_body:
      "Hello Rotabull Team,&nbsp;\n \n &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; I just tried using the Internal Notes tab on a quote I did for TAM on p/n 9077M99P02. I was hoping this is a note that would go into Global Notes in quantum but would\n not show anywhere for the customer to see. But I actually don’t see where this note is at all. Please let me know how this works. Thanks. \n &nbsp; \n &nbsp; \n  \n &nbsp; \n &nbsp; \n &nbsp; \n \n \n \n \n \n \n Best Regards, \n &nbsp; \n\n\n\n\n  \n\n\n Tomasz Kuczynski\n \n ATLANTIC JET SUPPORT, INC. \n 4801 Johnson Road, Suite 11, Coconut Creek, FL 33073, USA \n TEL: &nbsp;954-571-7983 |\ntomasz@ajsupport.com\n \n\n\n\n\n \n \n \n \n \n \n &nbsp; \n &nbsp;",
    html_body:
      "<p>Hello Rotabull Team,&nbsp;\n \n &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; I just tried using the Internal Notes tab on a quote I did for TAM on p/n 9077M99P02. I was hoping this is a note that would go into Global Notes in quantum but would\n not show anywhere for the customer to see. But I actually don’t see where this note is at all. Please let me know how this works. Thanks. \n &nbsp; \n &nbsp; \n  \n &nbsp; \n &nbsp; \n &nbsp; \n \n \n \n \n \n \n Best Regards, \n &nbsp; \n\n\n\n\n  \n\n\n Tomasz Kuczynski\n \n ATLANTIC JET SUPPORT, INC. \n 4801 Johnson Road, Suite 11, Coconut Creek, FL 33073, USA \n TEL: &nbsp;954-571-7983 |\ntomasz@ajsupport.com\n \n\n\n\n\n \n \n \n \n \n \n &nbsp; \n &nbsp;</p>",
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));
