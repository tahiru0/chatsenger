"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { pusherClient, EVENTS } from "@/lib/pusher";
import ConversationList from "@/components/conversation/ConversationList";
import ChatView from "@/components/conversation/ChatView";
import AuthForm from "@/components/auth/AuthForm";

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);

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

    const channel = pusherClient.subscribe(`user-${userId}`);
    
    channel.bind(EVENTS.NEW_MESSAGE, (messageData: { conversationId: number }) => {
      // Handle new message notification
      console.log("New message received in conversation:", messageData.conversationId);
    });
    
    return () => {
      pusherClient.unsubscribe(`user-${userId}`);
    };
  }, [userId]);

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
