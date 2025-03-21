import { NextResponse } from 'next/server';
import { db } from '@/db';
import { friends, users } from '@/db/schema';
import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';

// Get friend requests for the current user
export async function GET() {
  try {
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get pending friend requests sent to current user (incoming)
    const incomingRequests = await db
      .select({
        id: friends.id,
        status: friends.status,
        createdAt: friends.createdAt,
        senderId: friends.userId,
        sender: {
          id: users.id,
          name: users.name,
          phone: users.phone,
        }
      })
      .from(friends)
      .innerJoin(users, eq(friends.userId, users.id))
      .where(
        and(
          eq(friends.friendId, parseInt(userId)),
          eq(friends.status, 'pending')
        )
      );
    
    // Get pending friend requests sent by current user (outgoing)
    const outgoingRequests = await db
      .select({
        id: friends.id,
        status: friends.status,
        createdAt: friends.createdAt,
        recipientId: friends.friendId,
        recipient: {
          id: users.id,
          name: users.name,
          phone: users.phone,
        }
      })
      .from(friends)
      .innerJoin(users, eq(friends.friendId, users.id))
      .where(
        and(
          eq(friends.userId, parseInt(userId)),
          eq(friends.status, 'pending')
        )
      );
    
    return NextResponse.json({
      requests: {
        incoming: incomingRequests,
        outgoing: outgoingRequests
      }
    });
  } catch (error) {
    console.error('Failed to fetch friend requests:', error);
    return NextResponse.json({ error: 'Failed to fetch friend requests' }, { status: 500 });
  }
}

// Accept or reject a friend request
export async function POST(req: Request) {
  try {
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { requestId, action } = body;
    
    if (!requestId || !action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }
    
    // Find the friend request
    const friendRequest = await db.query.friends.findFirst({
      where: (friends, { and, eq }) => and(
        eq(friends.id, requestId),
        eq(friends.friendId, parseInt(userId)),
        eq(friends.status, 'pending')
      )
    });
    
    if (!friendRequest) {
      return NextResponse.json({ error: 'Friend request not found' }, { status: 404 });
    }
    
    // Update the request status
    await db
      .update(friends)
      .set({ 
        status: action === 'accept' ? 'accepted' : 'rejected',
        updatedAt: new Date()
      })
      .where(eq(friends.id, requestId));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to process friend request:', error);
    return NextResponse.json({ error: 'Failed to process friend request' }, { status: 500 });
  }
}
