import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('tasks').collect()
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) return []
    return await ctx.db
      .query('tasks')
      .filter(q => q.eq(q.field('userId'), identity.subject))
      .collect()
  },
})

export const createImportedTask = internalMutation({
  args: { text: v.string(), completed: v.boolean(), userId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert('tasks', { text: args.text, completed: args.completed, userId: args.userId })
  },
})

export const createTaskAsApi = internalMutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert('tasks', { text: args.text, completed: false, userId: 'api' })
  },
})

export const deleteTaskAsApi = internalMutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id)
    if (task === null) return false
    await ctx.db.delete(args.id)
    return true
  },
})

export const createTask = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw new Error('Non authentifié')
    await ctx.db.insert('tasks', { text: args.text, completed: false, userId: identity.subject })
  },
})

export const toggleTask = mutation({
  args: {
    id: v.id('tasks'),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw new Error('Non authentifié')
    const task = await ctx.db.get(args.id)
    if (task?.userId !== identity.subject) throw new Error('Non autorisé')
    await ctx.db.patch(args.id, { completed: args.completed })
  },
})

export const deleteTask = mutation({
  args: { id: v.id('tasks') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw new Error('Non authentifié')
    const task = await ctx.db.get(args.id)
    if (task?.userId !== identity.subject) throw new Error('Non autorisé')
    await ctx.db.delete(args.id)
  },
})
