import { NextResponse } from 'next/server';
import { db } from '@/db';
import { friends, users } from '@/db/schema';
import { cookies } from 'next/headers';
import { eq, and, or } from 'drizzle-orm';

// Simulate online status with a simple in-memory store
// In a real app, this would be handled with Redis or similar
const onlineUsers = new Map<number, { lastSeen: Date }>();

// Update a user's online status (this would be called when users connect/disconnect)
export function updateUserOnlineStatus(userId: number, isOnline: boolean) {
  if (isOnline) {
    onlineUsers.set(userId, { lastSeen: new Date() });
  } else {
    onlineUsers.set(userId, { lastSeen: new Date() });
  }
}

// Get all online friends
export async function GET() {
  try {
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update this user's online status
    updateUserOnlineStatus(parseInt(userId), true);
    
    // Get all friends
    const userFriends = await db
      .select({
        friendId: friends.friendId,
      })
      .from(friends)
      .where(and(
        eq(friends.userId, parseInt(userId)),
        eq(friends.status, 'accepted')
      ));
      
    const friendIds = userFriends.map(f => f.friendId);
    
    // Get friends where the current user is the friend
    const reverseFriends = await db
      .select({
        userId: friends.userId,
      })
      .from(friends)
      .where(and(
        eq(friends.friendId, parseInt(userId)),
        eq(friends.status, 'accepted')
      ));
    
    const reverseIds = reverseFriends.map(f => f.userId);
    
    // Combine both lists for all friends
    const allFriendIds = [...new Set([...friendIds, ...reverseIds])];
    
    // If no friends, return empty array
    if (allFriendIds.length === 0) {
      return NextResponse.json({ friends: [] });
    }
    
    // Get details of all friends
    const allFriends = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(or(...allFriendIds.map(id => eq(users.id, id))));
    
    // Check which friends are online (active in the last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const friendsWithStatus = allFriends.map(friend => {
      const onlineStatus = onlineUsers.get(friend.id);
      
      // Log để debug
      console.log(`User ${friend.id} (${friend.name}) status:`, onlineStatus);
      
      // Kiểm tra chặt chẽ hơn
      const isOnline = onlineStatus && 
                      onlineStatus.lastSeen && 
                      onlineStatus.lastSeen > fiveMinutesAgo;
      
      return {
        ...friend,
        isOnline: !!isOnline, // Chuyển đổi rõ ràng sang boolean
        lastSeen: onlineStatus?.lastSeen?.toISOString() || null,
      };
    });
    
    // Sort friends by online status
    const sortedFriends = friendsWithStatus.sort((a, b) => {
      // Online friends first
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      
      // Then sort by last seen
      if (a.lastSeen && b.lastSeen) {
        return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
      }
      
      return 0;
    });
    
    return NextResponse.json({ friends: sortedFriends });
  } catch (error) {
    console.error('Failed to fetch online friends:', error);
    return NextResponse.json({ error: 'Failed to fetch online friends' }, { status: 500 });
  }
}
