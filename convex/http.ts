import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

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

export default http;
