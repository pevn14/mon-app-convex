import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { rateLimiter } from "./rateLimiter";

const http = httpRouter();

function requireApiKey(req: Request): Response | null {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

async function checkRateLimit(ctx: any, req: Request): Promise<Response | null> {
  const apiKey = req.headers.get("x-api-key")!;
  const { ok } = await rateLimiter.limit(ctx, "api", { key: apiKey });
  if (!ok) {
    return new Response(
      JSON.stringify({ error: "Trop de requêtes — limite : 10 appels/minute" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}

http.route({
  path: "/ping",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ ok: true, message: "Hello" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/echo",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    const body = await req.json();
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/tasks",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const unauthorized = requireApiKey(req);
    if (unauthorized) return unauthorized;

    const limited = await checkRateLimit(ctx, req);
    if (limited) return limited;

    const tasks = await ctx.runQuery(internal.tasks.listAll);
    return new Response(JSON.stringify(tasks), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/tasks",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const unauthorized = requireApiKey(req);
    if (unauthorized) return unauthorized;

    const limited = await checkRateLimit(ctx, req);
    if (limited) return limited;

    const { text } = await req.json();
    const id = await ctx.runMutation(internal.tasks.createTaskAsApi, { text });
    return new Response(JSON.stringify({ created: true, id }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/task",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const unauthorized = requireApiKey(req);
    if (unauthorized) return unauthorized;

    const limited = await checkRateLimit(ctx, req);
    if (limited) return limited;

    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "id requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const deleted = await ctx.runMutation(internal.tasks.deleteTaskAsApi, { id: id as any });
    if (!deleted) {
      return new Response(JSON.stringify({ error: "Tâche introuvable" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ deleted: true, id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
