import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, parseInt(userId)),
      columns: {
        id: true,
        name: true,
        phone: true,
      },
    });
    
    if (!user) {
      // Properly awaited cookies deletion
      const cookiesStore = await cookies();
      cookiesStore.delete('userId');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ user });
  } catch (error: unknown) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
