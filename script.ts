import forge from "./forge/client";

//Take the result of answer 1 and use it as context for answer 2
const email = `
      "<p>Hello, Were having trouble with our ILS integration. We have had many requests via ILS, but they haven't been showing up in Rotabull for at least a week. Do you have any idea why this might be happening? I think that we may be logged into the account elsewhere. Should Rotabull be able to use the same account that we use manually to access the ILS API? Or is there some other reason that we're not seeing our ILS data in Rotabull? Thanks, ~Richard</p>",
`;

// Check against support docs first
const answer1 = await forge.$withContext(
  //   "You are a knowledgeable customer support assistant for rotabull. Your task is to provide accurate, helpful, and concise responses to user queries. Use the provided support documentation to inform your answers. Always maintain a professional and friendly tone. If you're unsure about something, it's okay to say so rather than guessing. Prioritize the most relevant information from the support docs to address the user's specific query. Your response should be in JSON format with 'suggested_articles' and 'suggested_response' fields." +
  "Instructions: Analyze the user query and provide a concise, helpful response. Reference relevant support documentation if applicable. Format your response as a JSON object with 'suggested_articles' (an array of relevant article URLs). Only fetch relevant article URLs." +
    "IMPORTANT: Your response MUST be a valid JSON object with 'suggested_articles' (an array of strings). Do not include any text outside of this JSON object." +
    //     "User Query: " +
    email,
  {
    collectionId: "166474b4-a050-4012-88d5-ff16bb6c54f3",
    chunkCount: 15,
  }
);

//Then check against the past tickets
const answer2 = await forge.$withContext(
  "You are a knowledgeable customer support assistant for rotabull. Your task is to provide accurate, helpful, and concise responses to user queries. Use the provided past ticket data to inform your answers. Always maintain a professional and friendly tone. If you're unsure about something, it's okay to say so rather than guessing. Prioritize the most relevant information from the past ticket data to address the user's specific query. Your response should be in JSON format with 'suggested_articles' and 'suggested_response' fields." +
    "Instructions: Analyze the provided output from the previous prompt and improve it by adjusting it based on relevant information from the past ticket data. Reference relevant ticket data if applicable. Format your response as a JSON object with 'suggested_articles' (an array of relevant article URLs) and 'suggested_response' (a string containing the response) fields." +
    "IMPORTANT: Your response MUST be a valid JSON object with 'suggested_articles' (an array of strings) and 'suggested_response' (a string) fields. Do not include any text outside of this JSON object. DO NOT make up any information, you must use the information provided to you. Include the 'suggested_articles' from the provided output." +
    email +
    "Provided output: " +
    answer1,
  {
    collectionId: "0105d805-655e-4992-8f46-ef7c71043c2d",
    chunkCount: 10,
  }
);

// const answer1 = await forge.$withContext(
//   `## What is it?

// [Inventory Locator Service (ILS)](https://rotabull.com/blog/ils-marketplace), is a parts locator service that lets you list inventory and repair capabilities, as well as search for vendors who can supply various parts. Rotabull supports the following integrations with ILS:

// - **Listing**: listing available parts and repair capabilities
// - **RFQs**: receiving RFQs from interested buyers into Rotabull

// > 📘 ILS requires a subscription
// >
// > ILS charges an annual membership that varies in price based on features, number of users, negotiation, and other factors. There is typically a flat fee for listing inventory / repair capabilities, as well as a component that depends on the number of line items listed. These fees are not included in Rotabull's subscription.

// ![](https://files.readme.io/f670958-Screen_Shot_2020-04-24_at_9.43.26_PM.png "Screen Shot 2020-04-24 at 9.43.26 PM.png")

// ## Listings Integration

// To sync your Rotabull listings to ILS, you should first link the marketplace with your credentials on the [Settings > Integrations](https://app.rotabull.com/settings/integrations) page, and click "Request Integration".

// [block:image]
// {
//   "images": [
//     {
//       "image": [
//         "https://files.readme.io/fb208fd-Screenshot_2024-04-26_at_2.12.06_PM.png",
//         "",
//         "ILS Integration Settings"
//       ],
//       "align": "center",
//       "sizing": "300px",
//       "caption": "ILS Integration Settings"
//     }
//   ]
// }
// [/block]

// For the ILS username, you will want to use your root User ID which can be found on the ILS website.  To find it, log into ILS and click My ILS, then Set Preferences, then the User tab (the User ID is directly below where it says Change Password):

// [block:image]
// {
//   "images": [
//     {
//       "image": [
//         "https://files.readme.io/0c4ba90-Screenshot_2024-07-05_at_4.46.33_PM.png",
//         "",
//         ""
//       ],
//       "align": "center"
//     }
//   ]
// }
// [/block]

// <br />

// In some cases, you may need to provision API access ("activate supplier web services") with ILS. Once provisioned, daily uploads will typically be enabled automatically.

// > 🚧 ILS sync can take up to 24 hours and does not occur on US holidays and weekends
// >
// > ILS listings sync is not instantaneous, given there is a human operator involved in the loading process at ILS. Listings are processed during ILS business hours (US Central time zone) Monday - Friday. Once Rotabull sends the inventory and/or capabilities, it can take up to 24 hours before appearing live on [www.ilsmart.com](http://www.ilsmart.com).
// >
// > If you need to expedite this process, it is usually advised to reach out to your ILS representative and ask them to process the file that is enqueued.

// Please double check that your listing rules are set the way you would like them, to ensure the right inventory is being sent to ILS daily.

// ## RFQs Integration

// To integrate RFQs from ILS, you can change your ILS settings to send emails directly to Rotabull. Before changing the settings, you'll need your **RFQ forwarding address** which can be found at the top of your Rotabull [Email Settings](https://app.rotabull.com/settings/email-settings).

// From your [ILS Home Page](https://members.ilsmart.com/), find the link to _Set Preferences:_

// [block:image]
// {
//   "images": [
//     {
//       "image": [
//         "https://files.readme.io/3ac4fbf-Screen_Shot_2023-06-27_at_10.48.22_AM.png",
//         null,
//         ""
//       ],
//       "align": "center"
//     }
//   ]
// }
// [/block]

// Then, on the next screen, click the Edit button next to _Company Profile_:

// [block:image]
// {
//   "images": [
//     {
//       "image": [
//         "https://files.readme.io/30eef78-Screen_Shot_2023-06-27_at_10.48.52_AM.png",
//         null,
//         ""
//       ],
//       "align": "center",
//       "sizing": "500px"
//     }
//   ]
// }
// [/block]

// Finally, you can enter your forwarding address on the **RFQ Recipient** (or **MRO RFQ Recipient**) tile as highlighted in **orange** by clicking the _Edit_ button:

// [block:image]
// {
//   "images": [
//     {
//       "image": [
//         "https://files.readme.io/b511bd7-Screen_Shot_2023-06-27_at_11.04.27_AM.png",
//         null,
//         ""
//       ],
//       "align": "center",
//       "sizing": "500px"
//     }
//   ]
// }
// [/block]

// You should see RFQs start to show up in Rotabull as soon as they're received. Please feel free to reach out to [support@rotabull.com](mailto:support@rotabull.com) for assistance if needed.`,
//   {
//     collectionId: "cf524f98-5e14-4b9b-b74b-8a20f71c5d86",
//     chunkCount: 3,
//   }
// );

console.log(answer1);
console.log(answer2);
