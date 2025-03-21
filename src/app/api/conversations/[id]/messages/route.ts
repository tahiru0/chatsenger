import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { messages, conversationParticipants, users } from '@/db/schema';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher';
import { eq, and, sql, lt, desc } from 'drizzle-orm';

// Get messages for a conversation with pagination
export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const conversationId = context.params.id;
    const userId = (await cookies()).get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is part of the conversation using direct query
    const participant = await db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, parseInt(conversationId)),
        eq(conversationParticipants.userId, parseInt(userId))
      ))
      .limit(1)
      .then(rows => rows[0]);
    
    if (!participant) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Get pagination parameters
    const searchParams = req.nextUrl.searchParams;
    const beforeId = searchParams.get('beforeId') ? parseInt(searchParams.get('beforeId')!) : null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    
    // Build the query differently to avoid TypeScript errors
    // Create where condition first
    const whereCondition = beforeId 
      ? and(
          eq(messages.conversationId, parseInt(conversationId)),
          lt(messages.id, beforeId)
        )
      : eq(messages.conversationId, parseInt(conversationId));
    
    // Then build the complete query in one chain
    const messagesWithSenders = await db
      .select({
        id: messages.id,
        content: messages.content,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
        status: messages.status,
        gifUrl: messages.gifUrl,
        sender: sql`json_build_object('id', ${users.id}, 'name', ${users.name})`
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(whereCondition)
      .orderBy(desc(messages.id))
      .limit(limit);
    
    // Get the total count of messages (for pagination info)
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.conversationId, parseInt(conversationId)))
      .then(result => result[0]?.count || 0);
    
    // Check if there are more messages to load
    const hasMore = beforeId ? 
      messagesWithSenders.length === limit : 
      messagesWithSenders.length < totalCount;
    
    // Return in chronological order (oldest to newest)
    return NextResponse.json({ 
      messages: messagesWithSenders.reverse(), 
      pagination: {
        hasMore,
        totalCount,
        nextCursor: messagesWithSenders.length > 0 ? messagesWithSenders[0].id : null
      }
    });
  } catch (error: unknown) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// Send a message
export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const conversationId = context.params.id;
    const userId = (await cookies()).get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is part of the conversation
    const participant = await db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, parseInt(conversationId)),
        eq(conversationParticipants.userId, parseInt(userId))
      ))
      .limit(1)
      .then(rows => rows[0]);
    
    if (!participant) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    const body = await req.json();
    const messageData = z.object({
      text: z.string().min(1).optional(),
      gifUrl: z.string().url().optional()
    }).parse(body);
    
    if (!messageData.text && !messageData.gifUrl) {
      return NextResponse.json({ error: 'Message must contain either text or a GIF' }, { status: 400 });
    }
    
    // Create message
    const [newMessage] = await db.insert(messages).values({
      conversationId: parseInt(conversationId),
      senderId: parseInt(userId),
      content: messageData.text || "Sent a GIF",
      gifUrl: messageData.gifUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    // Get the message with sender info using SQL builder
    const messageWithSender = await db
      .select({
        id: messages.id,
        content: messages.content,
        senderId: messages.senderId,
        createdAt: messages.createdAt,
        status: messages.status,
        gifUrl: messages.gifUrl,
        sender: sql`json_build_object('id', ${users.id}, 'name', ${users.name})`
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.id, newMessage.id))
      .then(rows => rows[0]);
    
    // Send Pusher event with lower-priority execution to not block response
    Promise.resolve().then(async () => {
      try {
        await pusherServer.trigger(
          `${CHANNELS.CONVERSATION}-${conversationId}`,
          EVENTS.NEW_MESSAGE,
          messageWithSender
        );
        console.log('Pusher event sent successfully');
      } catch (pusherError) {
        console.error('Failed to send Pusher event:', pusherError);
      }
    });
    
    // Return message immediately without waiting for Pusher
    return NextResponse.json(messageWithSender);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Failed to send message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
