import { NextResponse } from 'next/server';
import { db } from '@/db';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { cookies } from 'next/headers';

const loginSchema = z.object({
  phone: z.string(),
  password: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, password } = loginSchema.parse(body);
    
    // Find user
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.phone, phone),
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    // Set session cookie - properly awaited
    const cookiesStore = await cookies();
    cookiesStore.set('userId', String(user.id), {
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    
    return NextResponse.json({ 
      user: { id: user.id, name: user.name, phone: user.phone } 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
