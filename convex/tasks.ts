import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('tasks').collect()
  },
})

export const createTask = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert('tasks', { text: args.text, completed: false })
  },
})

export const toggleTask = mutation({
  args: {
    id: v.id('tasks'),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { completed: args.completed })
  },
})

export const deleteTask = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
