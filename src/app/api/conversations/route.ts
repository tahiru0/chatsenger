import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, conversationParticipants, users, messages } from '@/db/schema';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { eq, and, desc, inArray, ne } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Get all conversations for current user
export async function GET() {
  try {
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Use direct SQL query instead of relations to get conversation IDs
    const userParticipations = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, parseInt(userId)));
    
    const conversationIds = userParticipations.map(p => p.conversationId);
    
    if (conversationIds.length === 0) {
      return NextResponse.json({ conversations: [] });
    }
    
    // Get basic conversation info
    const userConversations = await db
      .select({
        id: conversations.id,
        name: conversations.name,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(inArray(conversations.id, conversationIds));
    
    // For each conversation, fetch participants and last message separately
    const conversationsWithDetails = await Promise.all(
      userConversations.map(async (conversation) => {
        // Build conditions array to exclude current user only if a userId is present
        const conditions = [eq(conversationParticipants.conversationId, conversation.id)];
        if (userId) {
          conditions.push(ne(conversationParticipants.userId, parseInt(userId)));
        }
        
        const participants = await db
          .select({
            id: users.id,
            name: users.name,
          })
          .from(conversationParticipants)
          .innerJoin(users, eq(conversationParticipants.userId, users.id))
          .where(and(...conditions));
        
        // Get last message
        const lastMessages = await db
          .select({
            content: messages.content,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, conversation.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        
        const lastMessage = lastMessages.length > 0 ? lastMessages[0] : undefined;
        
        return {
          id: conversation.id,
          name: conversation.name,
          participants: participants,
          lastMessage
        };
      })
    );

    // Sort conversations by last message time (newest first)
    const sortedConversations = conversationsWithDetails.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA; // Newest first
    });
    
    return NextResponse.json({ conversations: sortedConversations });
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

// Create a new conversation
export async function POST(req: Request) {
  try {
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { name, participantIds } = z.object({
      name: z.string().optional(),
      participantIds: z.array(z.number()).min(1)
    }).parse(body);
    
    // Make sure current user is not already in participantIds
    const allParticipantIds = [...new Set([...participantIds, parseInt(userId)])];
    
    // For direct messages (2 participants), check if conversation already exists
    if (allParticipantIds.length === 2) {
      const friendId = participantIds[0];
      
      // Get all conversations where both users are participants
      const currentUserConversations = await db
        .select({ conversationId: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.userId, parseInt(userId)));
      
      const currentUserConversationIds = currentUserConversations.map(row => row.conversationId);
      
      if (currentUserConversationIds.length > 0) {
        // Find conversations where friend is also a participant
        const sharedConversations = await db
          .select({ 
            conversationId: conversationParticipants.conversationId,
            totalParticipants: sql<number>`COUNT(*)`.as('totalParticipants')
          })
          .from(conversationParticipants)
          .where(and(
            inArray(conversationParticipants.conversationId, currentUserConversationIds),
            eq(conversationParticipants.userId, friendId)
          ))
          .groupBy(conversationParticipants.conversationId)
          // Use a raw SQL condition instead of an object for .having():
          .having(sql`COUNT(*) = 2`);

        // If a conversation already exists between these users, return it
        if (sharedConversations.length > 0) {
          const existingConversationId = sharedConversations[0].conversationId;
          
          // Get conversation details
          const conversation = await db
            .select({
              id: conversations.id,
              name: conversations.name,
              createdAt: conversations.createdAt
            })
            .from(conversations)
            .where(eq(conversations.id, existingConversationId))
            .limit(1)
            .then(rows => rows[0]);
          
          // Get participants
          const participants = await db
            .select({
              userId: conversationParticipants.userId,
              user: {
                id: users.id,
                name: users.name
              }
            })
            .from(conversationParticipants)
            .innerJoin(
              users,
              eq(conversationParticipants.userId, users.id)
            )
            .where(eq(conversationParticipants.conversationId, existingConversationId));
          
          return NextResponse.json({ 
            conversation: {
              ...conversation,
              participants: participants.map(p => ({
                userId: p.userId,
                user: p.user
              }))
            },
            existing: true
          });
        }
      }
    }
    
    // Create the conversation if it doesn't exist
    const [newConversation] = await db.insert(conversations).values({
      name,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    // Add participants
    await Promise.all(allParticipantIds.map(participantId => 
      db.insert(conversationParticipants).values({
        conversationId: newConversation.id,
        userId: participantId,
        joinedAt: new Date()
      })
    ));
    
    // Get the created conversation with participants using manual join
    const participants = await db
      .select({
        userId: conversationParticipants.userId,
        user: {
          id: users.id,
          name: users.name
        }
      })
      .from(conversationParticipants)
      .innerJoin(
        users,
        eq(conversationParticipants.userId, users.id)
      )
      .where(eq(conversationParticipants.conversationId, newConversation.id));
    
    const formattedConversation = {
      ...newConversation,
      participants: participants.map(p => ({
        userId: p.userId,
        user: p.user
      }))
    };
    
    return NextResponse.json({ conversation: formattedConversation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Failed to create conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
