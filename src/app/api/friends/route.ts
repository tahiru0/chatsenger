import { NextResponse } from 'next/server';
import { db } from '@/db';
import { friends, users } from '@/db/schema';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { pusherServer, EVENTS } from '@/lib/pusher';
import { and, eq } from 'drizzle-orm';

// Get all friends
export async function GET() {
  try {
    const userId = (await cookies()).get('userId')?.value;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Instead of using relations, use manual joins and two separate queries
    
    // Find friends where current user is the requester
    const sentFriendships = await db
      .select({
        friendDetails: {
          id: users.id,
          name: users.name,
          phone: users.phone,
        }
      })
      .from(friends)
      .innerJoin(users, eq(friends.friendId, users.id))
      .where(and(
        eq(friends.userId, parseInt(userId)),
        eq(friends.status, 'accepted')
      ));
    
    // Find friends where current user is the recipient
    const receivedFriendships = await db
      .select({
        friendDetails: {
          id: users.id,
          name: users.name,
          phone: users.phone,
        }
      })
      .from(friends)
      .innerJoin(users, eq(friends.userId, users.id))
      .where(and(
        eq(friends.friendId, parseInt(userId)),
        eq(friends.status, 'accepted')
      ));
    
    // Combine the results
    const allFriends = [
      ...sentFriendships.map(f => f.friendDetails),
      ...receivedFriendships.map(f => f.friendDetails)
    ];
    
    return NextResponse.json({ friends: allFriends });
  } catch (error: unknown) {
    console.error('Failed to fetch friends:', error);
    return NextResponse.json({ error: 'Failed to fetch friends' }, { status: 500 });
  }
}

// Send friend request
export async function POST(req: Request) {
  try {
    const userId = (await cookies()).get('userId')?.value;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { phone } = z.object({ phone: z.string() }).parse(body);
    
    // Get sender's name for notification
    const sender = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, parseInt(userId)),
      columns: {
        name: true,
      }
    });
    
    // Find user by phone
    const friend = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.phone, phone),
    });
    
    if (!friend) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    if (friend.id === parseInt(userId)) {
      return NextResponse.json({ error: 'Cannot add yourself as a friend' }, { status: 400 });
    }
    
    // Check if friend request already exists
    const existingRequest = await db.query.friends.findFirst({
      where: (friends, { and, or, eq }) => and(
        or(
          and(
            eq(friends.userId, parseInt(userId)),
            eq(friends.friendId, friend.id)
          ),
          and(
            eq(friends.userId, friend.id),
            eq(friends.friendId, parseInt(userId))
          )
        )
      ),
    });
    
    if (existingRequest) {
      return NextResponse.json({ error: 'Friend request already exists' }, { status: 400 });
    }
    
    // Create friend request
    await db.insert(friends).values({
      userId: parseInt(userId),
      friendId: friend.id,
      status: 'pending',
    });
    
    // Notify the recipient via Pusher
    await pusherServer.trigger(
      `user-${friend.id}`,
      EVENTS.NEW_FRIEND_REQUEST,
      {
        senderId: parseInt(userId),
        senderName: sender?.name || 'Someone',
      }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to send friend request' }, { status: 500 });
  }
}
