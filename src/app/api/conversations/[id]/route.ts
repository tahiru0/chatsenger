import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversationParticipants, conversations, users } from '@/db/schema';
import { cookies } from 'next/headers';
import { eq, ne, and } from 'drizzle-orm';

// Get a single conversation by ID
export async function GET(
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
    
    // Check if user is part of the conversation using direct query
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
    
    // Get conversation details
    const conversationDetails = await db
      .select({
        id: conversations.id,
        name: conversations.name,
        createdAt: conversations.createdAt
      })
      .from(conversations)
      .where(eq(conversations.id, parseInt(conversationId)))
      .limit(1)
      .then(rows => rows[0]);
    
    if (!conversationDetails) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Get all participants except current user
    const otherParticipants = await db
      .select({
        id: users.id,
        name: users.name
      })
      .from(conversationParticipants)
      .innerJoin(users, eq(conversationParticipants.userId, users.id))
      .where(and(
        eq(conversationParticipants.conversationId, parseInt(conversationId)),
        ne(conversationParticipants.userId, parseInt(userId))
      ));
    
    return NextResponse.json({
      conversation: {
        ...conversationDetails,
        participants: otherParticipants
      }
    });
  } catch (error) {
    console.error('Failed to fetch conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

// Delete a conversation
export async function DELETE(
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
    
    // Check if user is part of the conversation using direct query
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
    
    // Delete conversation and rely on cascade deletion for participants and messages
    await db.delete(conversations)
      .where(eq(conversations.id, parseInt(conversationId)));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
