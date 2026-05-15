import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    completed: v.boolean(),
    userId: v.string(),
    fileId: v.optional(v.id('files')),
  }),
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index('by_name', ['name']),
  files: defineTable({
    storageId: v.id('_storage'),
    filename: v.string(),
    contentType: v.string(),
  }),
})
