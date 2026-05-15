import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const listFiles = query({
  args: {},
  handler: async (ctx) => {
    const files = await ctx.db.query("files").take(20);
    return await Promise.all(
      files.map(async (file) => ({
        ...file,
        url: await ctx.storage.getUrl(file.storageId),
      }))
    );
  },
});

export const deleteFile = mutation({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id)
    if (file === null) return
    await ctx.storage.delete(file.storageId)
    await ctx.db.delete(args.id)
  },
});

export const saveFile = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("files", {
      storageId: args.storageId,
      filename: args.filename,
      contentType: args.contentType,
    });
  },
});
