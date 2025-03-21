import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, conversationParticipants } from '@/db/schema';
import { cookies } from 'next/headers';
import { z } from 'zod';

type ConversationParticipant = {
  user: {
    id: number;
    name: string;
    phone: string;
  };
};

interface FullConversation {
  id: number;
  name: string | null;
  participants: ConversationParticipant[];
}

// Get all conversations for current user
export async function GET() {
  try {
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // First, get all conversation IDs where the current user is a participant
    const userParticipations = await db.query.conversationParticipants.findMany({
      where: (cp, { eq }) => eq(cp.userId, parseInt(userId)),
      columns: {
        conversationId: true
      }
    });
    
    const conversationIds = userParticipations.map(p => p.conversationId);
    
    if (conversationIds.length === 0) {
      return NextResponse.json({ conversations: [] });
    }
    
    // Get full conversation details with participants
    const userConversations = (await db.query.conversations.findMany({
      where: (conversations, { inArray }) => inArray(conversations.id, conversationIds),
      with: {
        participants: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                phone: true,
              }
            }
          }
        }
      }
    })) as FullConversation[];
    
    // For each conversation, get the last message
    const conversationsWithLastMessage = await Promise.all(
      userConversations.map(async (conversation) => {
        // Get last message
        const lastMessage = await db.query.messages.findFirst({
          where: (messages, { eq }) => eq(messages.conversationId, conversation.id),
          orderBy: (messages, { desc }) => [desc(messages.createdAt)],
          columns: {
            content: true,
            createdAt: true,
          }
        });
        
        // Format participants for the client
        const formattedParticipants = conversation.participants
          .filter((p: ConversationParticipant) => p.user.id !== parseInt(userId!)) // Remove current user
          .map((p: ConversationParticipant) => ({
            id: p.user.id,
            name: p.user.name,
          }));
        
        return {
          id: conversation.id,
          name: conversation.name,
          participants: formattedParticipants,
          lastMessage: lastMessage || undefined
        };
      })
    );
    
    return NextResponse.json({ conversations: conversationsWithLastMessage });
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
    
    // Create the conversation
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
    
    // Get the created conversation with participants
    const createdConversation = await db.query.conversations.findFirst({
      where: (conversations, { eq }) => eq(conversations.id, newConversation.id),
      with: {
        participants: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });
    
    return NextResponse.json({ conversation: createdConversation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Failed to create conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
