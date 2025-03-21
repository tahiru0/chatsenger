import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, conversationParticipants } from '@/db/schema';
import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher';

// Update conversation name
export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const conversationId = context.params.id;
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is part of the conversation
    const participant = await db
      .select({ 
        conversationId: conversationParticipants.conversationId,
        userId: conversationParticipants.userId
      })
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
    
    const body = await request.json();
    const { name } = body;
    
    // Update conversation name
    await db
      .update(conversations)
      .set({ 
        name: name || null, // Allow setting to null/empty for default naming
        updatedAt: new Date()
      })
      .where(eq(conversations.id, parseInt(conversationId)));
    
    // Create a new event for conversation update
    const updateEvent = {
      conversationId: parseInt(conversationId),
      updatedBy: parseInt(userId),
      name: name || null,
      timestamp: new Date().toISOString()
    };

    // Notify via pusher to the conversation channel
    await pusherServer.trigger(
      `${CHANNELS.CONVERSATION}-${conversationId}`,
      EVENTS.CONVERSATION_UPDATED,
      updateEvent
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update conversation name:', error);
    return NextResponse.json({ error: 'Failed to update conversation name' }, { status: 500 });
  }
}
