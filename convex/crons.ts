import { cronJobs } from "convex/server";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const getCronCounter = query({
  args: {},
  handler: async (ctx) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "cron"))
      .unique();
    return counter?.value ?? 0;
  },
});

export const incrementCounter = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "cron"))
      .unique();
    if (counter === null) {
      await ctx.db.insert("counters", { name: "cron", value: 1 });
    } else {
      await ctx.db.patch(counter._id, { value: counter.value + 1 });
    }
    // console.log(`[cron] heartbeat — compteur : ${(counter?.value ?? 0) + 1}`);
  },
});

const crons = cronJobs();

crons.interval("heartbeat toutes les 2 minutes", { minutes: 2 }, internal.crons.incrementCounter, {});

export default crons;
