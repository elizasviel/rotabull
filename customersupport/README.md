# rotabull Customer Response Suggester

The rotabull Customer Response Suggester is a single API endpoint that can be used to generate a response from the Anthropic model.
Running index.ts will start a cron job that will fetch the latest Zendesk ticket data and README documentation on a weekly basis.
Ticket data includes data from up to 365 days ago to the present.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

Remember to set the following environment variables in a .env file:

ANTHROPIC_API_KEY
README_API_TOKEN
ZENDESK_API_TOKEN
ZENDESK_USER_EMAIL
ZENDESK_SUBDOMAIN

# rotabull Customer Response Suggester
