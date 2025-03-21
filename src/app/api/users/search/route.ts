import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get phone from query params
    const searchParams = req.nextUrl.searchParams;
    const phone = searchParams.get('phone');
    
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }
    
    // Find user by phone number
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.phone, phone),
      columns: {
        id: true,
        name: true,
        phone: true,
      },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Don't allow finding yourself
    if (user.id === parseInt(userId)) {
      return NextResponse.json({ error: 'Cannot add yourself as a friend' }, { status: 400 });
    }
    
    // Check if already friends or has pending request
    const existingRelationship = await db.query.friends.findFirst({
      where: (friends, { and, or, eq }) => and(
        or(
          and(
            eq(friends.userId, parseInt(userId)),
            eq(friends.friendId, user.id)
          ),
          and(
            eq(friends.userId, user.id),
            eq(friends.friendId, parseInt(userId))
          )
        )
      ),
    });
    
    if (existingRelationship) {
      if (existingRelationship.status === 'accepted') {
        return NextResponse.json({ error: 'Already friends with this user' }, { status: 400 });
      } else {
        return NextResponse.json({ error: 'Friend request already pending' }, { status: 400 });
      }
    }
    
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Failed to search for user:', error);
    return NextResponse.json({ error: 'Failed to search for user' }, { status: 500 });
  }
}
