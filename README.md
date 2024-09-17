# Rotabull Customer Response Suggester

## Features

- Automated weekly data updates from Zendesk and README documentation
- AI-powered response generation using Anthropic's model
- Integration with Forge (https://forge-ml.com/) for efficient data storage and retrieval
- RESTful API endpoint for generating response suggestions
- Scheduled jobs for maintaining up-to-date support data
- PostgreSQL database for storing ticket and user information

## Installation

1. Clone the repository:

   ```bash
   git clone [your-repository-url]
   cd rotabull-customer-response-suggester
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Set up environment variables in a `.env` file:

   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   README_API_TOKEN=your_readme_api_token
   ZENDESK_API_TOKEN=your_zendesk_api_token
   ZENDESK_USER_EMAIL=your_zendesk_email
   ZENDESK_SUBDOMAIN=your_zendesk_subdomain
   FORGE_KEY=your_forge_key
   DATABASE_URL=your_database_url
   ```

## Usage

To start the application:

bash
bun run checkZendeskFirst.ts

## API Endpoints

### Generate Response Suggestion

POST /suggest

Request body:

{
"subject": "My subject",
"requester": "john@example.com",
"text_body": "I'm having an issue with XYZ...",
"html_body": "<html><p>I'm having an issue with XYZ...</p></html>"
}

Response:
{
"suggested_articles": [
"https://support.rotabull.com/docs/article-slug-1",
"https://support.rotabull.com/docs/article-slug-2"
],
"suggested_response": "AI-generated response text"
}

### Trigger Manual Job

GET /triggerManualJob

Manually triggers the data update job.

## Development

The project uses TypeScript and is structured as follows:

- `src/`: Contains the main application logic
  - `checkZendeskFirst.ts`: Main Express application setup
  - `fetchReadme.ts`: Fetches and processes README documentation
  - `fetchTickets.ts`: Fetches and processes Zendesk tickets
  - `fetchUsers.ts`: Fetches and stores Zendesk user data
  - `scheduledJobs.ts`: Defines scheduled jobs for data updates
  - `handler.ts`: Serverless handler for the API
  - `scheduledJobHandler.ts`: Serverless handler for scheduled jobs
- `prisma/`: Database schema and migrations
- `scripts/`: Utility scripts for database operations
- `forge/`: Configuration for Forge ML integration

### Key Components

1. **Express Application**: The main API is built using Express.js.
2. **Prisma ORM**: Used for database operations and schema management.
3. **Forge ML**: Integrated for efficient data storage and retrieval.
4. **Serverless Framework**: Used for deploying the application to AWS.
5. **Cron Jobs**: Implemented for regular data updates.

## Deployment

The application is configured for deployment on AWS using Serverless Framework. To deploy:

1. Ensure you have the Serverless Framework installed and configured with your AWS credentials.
2. Run the deployment command:
   ```bash
   serverless deploy
   ```

## Database Schema

The PostgreSQL database includes the following main tables:

- `ForgeTicketCollection`: Stores a reference to Forge collections for tickets
- `ForgeDocsCollection`: Stores a reference to Forge collections for documentation
- `SupportDoc`: Stores README documentation
- `ZendeskTicket`: Stores Zendesk ticket information
- `ZendeskTicketComment`: Stores comments associated with Zendesk tickets
- `ZendeskUser`: Stores Zendesk user information
