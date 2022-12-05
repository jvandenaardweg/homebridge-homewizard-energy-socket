import { setupServer } from "msw/node";

import { handlers } from "@/api/mocks/handlers";

export const server = setupServer(...handlers);
