import { components } from "./_generated/api";
import { RateLimiter } from "@convex-dev/rate-limiter";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  api: { kind: "fixed window", rate: 10, period: 60_000 },
});
