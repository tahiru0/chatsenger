"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pusherClient, EVENTS, CHANNELS } from "@/lib/pusher";
import ConversationList from "@/components/conversation/ConversationList";
import ChatView from "@/components/conversation/ChatView";
import AuthForm from "@/components/auth/AuthForm";
import { useToast } from "@/providers/ToastProvider";

// Define type for conversations
type Conversation = {
  id: number;
  name: string | null;
  lastMessage?: {
    content: string;
    createdAt: string;
  };
  participants: {
    id: number;
    name: string;
  }[];
};

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUserId(data.user.id);
      }
    };
    
    checkAuth();
  }, []);

  // Fetch conversations
  const { data: conversationsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    enabled: !!userId,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!userId) return;

    // Subscribe to user-specific events for notifications
    const userChannel = pusherClient.subscribe(`user-${userId}`);
    
    userChannel.bind(EVENTS.NEW_MESSAGE, (messageData: { conversationId: number; message: string }) => {
      // Handle new message notification
      addToast(`New message in conversation`, 'info');
      
      // Invalidate the conversation query to refresh data
      queryClient.invalidateQueries({ queryKey: ['conversation', messageData.conversationId] });
    });
    
    // Friend request notification
    userChannel.bind(EVENTS.NEW_FRIEND_REQUEST, (data: { senderId: number; senderName: string }) => {
      addToast(`New friend request from ${data.senderName}`, 'info');
    });
    
    // Friend request accepted notification
    userChannel.bind(EVENTS.FRIEND_REQUEST_ACCEPTED, (data: { friendName: string }) => {
      addToast(`${data.friendName} accepted your friend request`, 'success');
    });

    // When conversation name changes, update the conversation list
    const handleConversationUpdate = (data: { conversationId: number }) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', data.conversationId] });
    };
    
    // Listen for conversation updates
    const conversations = conversationsData?.conversations as Conversation[] || [];
    conversations.forEach((conversation) => {
      const conversationChannel = pusherClient.subscribe(`${CHANNELS.CONVERSATION}-${conversation.id}`);
      conversationChannel.bind(EVENTS.CONVERSATION_UPDATED, handleConversationUpdate);
    });
    
    return () => {
      userChannel.unbind_all();
      pusherClient.unsubscribe(`user-${userId}`);
      
      // Unsubscribe from conversation channels
      const conversations = conversationsData?.conversations as Conversation[] || [];
      conversations.forEach((conversation) => {
        pusherClient.unsubscribe(`${CHANNELS.CONVERSATION}-${conversation.id}`);
      });
    };
  }, [userId, addToast, conversationsData?.conversations, queryClient]);

  if (!userId) {
    return <AuthForm onLogin={setUserId} />;
  }

  return (
    <div className="flex h-screen bg-base-100">
      {/* Left sidebar - Conversation list */}
      <div className="w-1/3 border-r border-base-300">
        <ConversationList
          conversations={conversationsData?.conversations || []}
          selectedId={selectedConversation}
          onSelect={setSelectedConversation}
        />
      </div>
      
      {/* Right side - Chat view */}
      <div className="w-2/3 flex flex-col">
        {selectedConversation ? (
          <ChatView conversationId={selectedConversation} userId={userId} />
        ) : (
          <div className="flex items-center justify-center h-full text-base-content/50">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
