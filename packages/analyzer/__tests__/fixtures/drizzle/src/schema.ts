import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
})

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id').notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))
