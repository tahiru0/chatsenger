import { NextResponse } from 'next/server';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher';

// Get messages for a conversation
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = (await cookies()).get('userId')?.value;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is part of the conversation
    const participant = await db.query.conversationParticipants.findFirst({
      where: (cp, { and, eq }) => and(
        eq(cp.conversationId, parseInt(params.id)),
        eq(cp.userId, parseInt(userId))
      ),
    });
    
    if (!participant) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Get messages
    const conversationMessages = await db.query.messages.findMany({
      where: (messages, { eq }) => eq(messages.conversationId, parseInt(params.id)),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      with: {
        sender: {
          columns: {
            id: true,
            name: true,
          }
        }
      }
    });
    
    return NextResponse.json({ messages: conversationMessages });
  } catch (error: unknown) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// Send a message
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = (await cookies()).get('userId')?.value;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is part of the conversation
    const participant = await db.query.conversationParticipants.findFirst({
      where: (cp, { and, eq }) => and(
        eq(cp.conversationId, parseInt(params.id)),
        eq(cp.userId, parseInt(userId))
      ),
    });
    
    if (!participant) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    const body = await req.json();
    const { content } = z.object({ content: z.string().min(1) }).parse(body);
    
    // Create message
    const [newMessage] = await db.insert(messages).values({
      conversationId: parseInt(params.id),
      senderId: parseInt(userId),
      content,
    }).returning();
    
    // Get the message with sender info
    const messageWithSender = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.id, newMessage.id),
      with: {
        sender: {
          columns: {
            id: true,
            name: true,
          }
        }
      }
    });
    
    // Trigger Pusher event
    await pusherServer.trigger(
      `${CHANNELS.CONVERSATION}-${params.id}`,
      EVENTS.NEW_MESSAGE,
      messageWithSender
    );
    
    return NextResponse.json(messageWithSender);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
