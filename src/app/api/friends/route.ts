import { NextResponse } from 'next/server';
import { db } from '@/db';
import { friends } from '@/db/schema';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { pusherServer, CHANNELS, EVENTS } from '@/lib/pusher';

// Get all friends
export async function GET() {
  try {
    const userId = (await cookies()).get('userId')?.value;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userFriends = await db.query.friends.findMany({
      where: (friends, { eq, and, or }) => and(
        or(
          eq(friends.userId, parseInt(userId)),
          eq(friends.friendId, parseInt(userId))
        ),
        eq(friends.status, 'accepted')
      ),
      with: {
        user: true,
        friend: true,
      },
    });
    
    const formattedFriends = userFriends.map(relationship => {
      // If current user is the "userId", return the friend details
      if (relationship.userId === parseInt(userId)) {
        return relationship.friend;
      }
      // If current user is the "friendId", return the user details
      return relationship.user;
    });
    
    return NextResponse.json({ friends: formattedFriends });
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
    
    // Trigger Pusher event
    await pusherServer.trigger(
      `${CHANNELS.FRIENDS}-${friend.id}`,
      EVENTS.NEW_FRIEND_REQUEST,
      {
        senderId: parseInt(userId),
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
