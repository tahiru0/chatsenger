import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
});

export async function PUT(req: Request) {
  try {
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse and validate the request body
    const body = await req.json();
    const { name } = profileUpdateSchema.parse(body);
    
    // Update the user's profile
    await db.update(users)
      .set({ 
        name,
        updatedAt: new Date()
      })
      .where(eq(users.id, parseInt(userId)));
    
    // Get the updated user data
    const updatedUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, parseInt(userId)),
      columns: {
        id: true,
        name: true,
        phone: true,
      }
    });
    
    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
