import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { pusherClient, CHANNELS, EVENTS } from '@/lib/pusher';
import { Message } from '@/types/chat';

// Import or define the interfaces from useChatMessages.ts
interface MessagePage {
  messages: Message[];
  pagination: {
    hasMore: boolean;
    totalCount: number;
    nextCursor: string | null;
  };
}

interface MessagesInfiniteData {
  pages: MessagePage[];
  pageParams: (string | undefined)[];
}

export const useChatRealtime = (
  conversationId: number, 
  userId: string, 
  markAsSeenMutation: { mutate: (id: number) => void }
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = pusherClient.subscribe(`${CHANNELS.CONVERSATION}-${conversationId}`);
    
    // Handle reconnection events
    const handleConnectionStateChange = (state: string) => {
      if (state === 'connected') {
        console.log('Pusher reconnected successfully');
      } else if (state === 'connecting') {
        console.log('Pusher reconnecting...');
      } else if (state === 'failed') {
        console.error('Pusher connection failed');
        // Try to reconnect after a delay
        setTimeout(() => {
          pusherClient.connect();
        }, 3000);
      }
    };
    
    pusherClient.connection.bind('state_change', handleConnectionStateChange);
    
    channel.bind(EVENTS.NEW_MESSAGE, (message: Message) => {
      console.log('Received new message via Pusher:', message);
      
      // Replace optimistic message if this is our own message
      if (message.senderId === parseInt(userId)) {
        queryClient.setQueryData<MessagesInfiniteData>(['messages', conversationId], (old: MessagesInfiniteData | undefined) => {
          if (!old) return { 
            pages: [{
              messages: [message],
              pagination: { hasMore: false, totalCount: 1, nextCursor: null }
            }],
            pageParams: [undefined]
          };
          
          // Replace temporary message with real one or add if not found
          const newPages = old.pages.map((page: MessagePage) => ({
            ...page,
            messages: page.messages.map((msg: Message) => 
              msg.id.toString().startsWith('temp-') ? message : msg
            )
          }));
          
          return {
            ...old,
            pages: newPages
          };
        });
      } else {
        // For messages from others
        queryClient.setQueryData<MessagesInfiniteData>(['messages', conversationId], (old: MessagesInfiniteData | undefined) => {
          if (!old) return { 
            pages: [{
              messages: [message],
              pagination: { hasMore: false, totalCount: 1, nextCursor: null }
            }],
            pageParams: [undefined]
          };
          
          // Check if message already exists
          const messageExists = old.pages.some((page: MessagePage) => 
            page.messages.some((m: Message) => m.id === message.id)
          );
          
          if (messageExists) return old;
          
          // Add to last page
          const lastPageIndex = old.pages.length - 1;
          const newPages = [...old.pages];
          newPages[lastPageIndex] = {
            ...newPages[lastPageIndex],
            messages: [...newPages[lastPageIndex].messages, message]
          };
          
          return {
            ...old,
            pages: newPages
          };
        });
        
        // Mark message as seen if it's not from the current user
        if (typeof message.id === 'number') {
          markAsSeenMutation.mutate(message.id);
        }
      }
    });
    
    channel.bind(EVENTS.MESSAGE_SEEN, ({ messageId }: { messageId: number, userId: number }) => {
      // Update message status in the list
      queryClient.setQueryData<MessagesInfiniteData>(['messages', conversationId], (old: MessagesInfiniteData | undefined) => {
        if (!old) return old;
        
        // Update messages in all pages
        const newPages = old.pages.map((page: MessagePage) => ({
          ...page,
          messages: page.messages.map((msg: Message) => 
            msg.id === messageId ? { ...msg, status: 'seen' as const } : msg
          )
        }));
        
        return {
          ...old,
          pages: newPages
        };
      });
    });
    
    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(`${CHANNELS.CONVERSATION}-${conversationId}`);
      pusherClient.connection.unbind('state_change', handleConnectionStateChange);
    };
  }, [conversationId, userId, queryClient, markAsSeenMutation]);
};
