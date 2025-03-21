import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cookies } from 'next/headers';

// Get a single conversation by ID
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
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
    
    // Get conversation details with participants
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq }) => eq(conversations.id, parseInt(params.id)),
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
    });
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Format participants for the client
    const formattedParticipants = conversation.participants.map(p => ({
      id: p.user.id,
      name: p.user.name,
    }));
    
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        name: conversation.name,
        participants: formattedParticipants,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      }
    });
  } catch (error) {
    console.error('Failed to fetch conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}
