import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const fetchPost = action({
  args: { id: v.number() },
  handler: async (_ctx, args) => {
    const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${args.id}`);
    const data = await response.json();
    return data;
  },
});

export const importTodo = action({
  args: { id: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error('Non authentifié');

    const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${args.id}`);
    const todo = await response.json();
    await ctx.runMutation(internal.tasks.createImportedTask, {
      text: todo.title,
      completed: todo.completed,
      userId: identity.subject,
    });
  },
});
