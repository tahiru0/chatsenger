import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { messageSeen, messages } from '@/db/schema';
import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher';

// Simplified route handler without type annotations that cause build errors
export async function POST(
  req: NextRequest,
  context: { params: { id: string; messageId: string } }
) {
  try {
    const { id: conversationId, messageId } = context.params;

    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is part of the conversation
    const participant = await db.query.conversationParticipants.findFirst({
      where: (cp, { and, eq }) => and(
        eq(cp.conversationId, parseInt(conversationId)),
        eq(cp.userId, parseInt(userId))
      ),
    });
    
    if (!participant) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Check if message exists
    const message = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.id, parseInt(messageId)),
    });
    
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    // Check if message is already seen by this user
    const existingSeen = await db.query.messageSeen.findFirst({
      where: (ms, { and, eq }) => and(
        eq(ms.messageId, parseInt(messageId)),
        eq(ms.userId, parseInt(userId))
      ),
    });
    
    if (!existingSeen) {
      // Add seen record
      await db.insert(messageSeen).values({
        messageId: parseInt(messageId),
        userId: parseInt(userId),
        seenAt: new Date(),
      });
      
      // Update message status to 'seen'
      await db.update(messages)
        .set({ status: 'seen', updatedAt: new Date() })
        .where(and(
          eq(messages.id, parseInt(messageId)),
          eq(messages.conversationId, parseInt(conversationId))
        ));
      
      // Notify via Pusher
      await pusherServer.trigger(
        `${CHANNELS.CONVERSATION}-${conversationId}`,
        EVENTS.MESSAGE_SEEN,
        {
          messageId: parseInt(messageId),
          userId: parseInt(userId),
        }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark message as seen:', error);
    return NextResponse.json({ error: 'Failed to mark message as seen' }, { status: 500 });
  }
}
