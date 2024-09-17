import serverlessHttp from "serverless-http";

import { app } from "./checkZendeskFirst";

export const handler = serverlessHttp(app);
