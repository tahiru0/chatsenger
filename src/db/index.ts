import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { relations } from 'drizzle-orm';

// Establish database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

// Set up relations between tables for queries
// Define relations BEFORE creating the db instance
relations(schema.users, ({ many }) => ({
  sentFriendRequests: many(schema.friends, { relationName: 'userSentRequests' }),
  receivedFriendRequests: many(schema.friends, { relationName: 'userReceivedRequests' }),
  participatedConversations: many(schema.conversationParticipants),
  messages: many(schema.messages),
  seenMessages: many(schema.messageSeen),
}));

relations(schema.friends, ({ one }) => ({
  user: one(schema.users, {
    fields: [schema.friends.userId],
    references: [schema.users.id],
    relationName: 'userSentRequests',
  }),
  friend: one(schema.users, {
    fields: [schema.friends.friendId],
    references: [schema.users.id],
    relationName: 'userReceivedRequests',
  }),
}));

relations(schema.conversations, ({ many }) => ({
  participants: many(schema.conversationParticipants),
  messages: many(schema.messages),
}));

relations(schema.conversationParticipants, ({ one }) => ({
  conversation: one(schema.conversations, {
    fields: [schema.conversationParticipants.conversationId],
    references: [schema.conversations.id],
  }),
  user: one(schema.users, {
    fields: [schema.conversationParticipants.userId],
    references: [schema.users.id],
  }),
}));

relations(schema.messages, ({ one, many }) => ({
  conversation: one(schema.conversations, {
    fields: [schema.messages.conversationId],
    references: [schema.conversations.id],
  }),
  sender: one(schema.users, {
    fields: [schema.messages.senderId],
    references: [schema.users.id],
  }),
  seenBy: many(schema.messageSeen),
}));

relations(schema.messageSeen, ({ one }) => ({
  message: one(schema.messages, {
    fields: [schema.messageSeen.messageId],
    references: [schema.messages.id],
  }),
  user: one(schema.users, {
    fields: [schema.messageSeen.userId],
    references: [schema.users.id],
  }),
}));

// Create Drizzle ORM instance AFTER relations are defined
export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development',
});

export { schema };
