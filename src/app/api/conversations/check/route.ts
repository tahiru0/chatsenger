import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, conversationParticipants, users } from '@/db/schema';
import { cookies } from 'next/headers';
import { and, eq, inArray, count, sql } from 'drizzle-orm';

// Kiểm tra nếu cuộc trò chuyện giữa người dùng hiện tại và một người dùng khác đã tồn tại
export async function GET(req: NextRequest) {
  try {
    const cookiesStore = await cookies();
    const userId = cookiesStore.get('userId')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Lấy friendId từ query string
    const searchParams = req.nextUrl.searchParams;
    const friendId = searchParams.get('friendId');
    
    if (!friendId) {
      return NextResponse.json({ error: 'friendId is required' }, { status: 400 });
    }
    
    // Lấy tất cả các cuộc trò chuyện mà người dùng hiện tại tham gia
    const currentUserConversations = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, parseInt(userId)));
    
    const currentUserConversationIds = currentUserConversations.map(row => row.conversationId);
    
    if (currentUserConversationIds.length === 0) {
      return NextResponse.json({ exists: false });
    }
    
    // Tìm những cuộc trò chuyện mà bạn bè tham gia
    const friendConversations = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(and(
        inArray(conversationParticipants.conversationId, currentUserConversationIds),
        eq(conversationParticipants.userId, parseInt(friendId))
      ));
    
    // Lấy các ID cuộc trò chuyện chung
    const sharedConversationIds = friendConversations.map(row => row.conversationId);
    
    if (sharedConversationIds.length === 0) {
      return NextResponse.json({ exists: false });
    }
    
    // Tìm cuộc trò chuyện chỉ có 2 người tham gia
    for (const conversationId of sharedConversationIds) {
      // Đếm số người tham gia
      const participantCount = await db
        .select({
          count: count()
        })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conversationId));
      
      // Nếu chỉ có 2 người tham gia (1-1 conversation)
      if (participantCount[0].count === 2) {
        // Lấy thông tin chi tiết của cuộc trò chuyện
        const conversation = await db
          .select({
            id: conversations.id,
            name: conversations.name,
            createdAt: conversations.createdAt
          })
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .limit(1)
          .then(rows => rows[0]);
        
        // Lấy thông tin người tham gia (bạn)
        const participantInfo = await db
          .select({
            id: users.id,
            name: users.name
          })
          .from(conversationParticipants)
          .innerJoin(users, eq(conversationParticipants.userId, users.id))
          .where(and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.userId, parseInt(friendId))
          ))
          .limit(1)
          .then(rows => rows[0]);
        
        return NextResponse.json({
          exists: true,
          conversation: {
            ...conversation,
            participants: [participantInfo]
          }
        });
      }
    }
    
    // Nếu không tìm thấy cuộc trò chuyện phù hợp
    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error('Failed to check conversation:', error);
    return NextResponse.json({ error: 'Failed to check conversation' }, { status: 500 });
  }
}
