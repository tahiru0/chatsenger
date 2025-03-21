import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/providers/ToastProvider';
import { Message } from '@/types/chat';

// Define interfaces for our data structures
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

export const useChatMessages = (conversationId: number, userId: string) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  // Fetch messages with infinite query
  const { 
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status
  } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam }) => {
      const url = new URL(`/api/conversations/${conversationId}/messages`, window.location.origin);
      
      if (pageParam) {
        url.searchParams.set('beforeId', pageParam);
      }
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore ? lastPage.messages[0]?.id : undefined;
    },
    initialPageParam: undefined,
  });

  // Send message mutation with optimistic updates
  const sendMessageMutation = useMutation({
    mutationFn: async (content: { text?: string; gifUrl?: string }) => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(content),
      });
      
      if (!res.ok) {
        throw new Error('Failed to send message');
      }
      
      return res.json();
    },
    onMutate: async (newMessageData) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      
      // Create optimistic message
      const optimisticId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: optimisticId,
        content: newMessageData.text || "Sent a GIF",
        senderId: parseInt(userId),
        createdAt: new Date().toISOString(),
        status: 'sent' as const,
        gifUrl: newMessageData.gifUrl,
        sender: {
          id: parseInt(userId),
          name: 'You' // Will be replaced by real data from Pusher
        }
      };
      
      // Add optimistic message to list
      queryClient.setQueryData<MessagesInfiniteData>(['messages', conversationId], (old: MessagesInfiniteData | undefined) => {
        if (!old) return { 
          pages: [{ 
            messages: [optimisticMessage],
            pagination: { hasMore: false, totalCount: 1, nextCursor: null } 
          }],
          pageParams: [undefined]
        };
        
        // Add to last page
        const lastPageIndex = old.pages.length - 1;
        const newPages = [...old.pages];
        newPages[lastPageIndex] = {
          ...newPages[lastPageIndex],
          messages: [...newPages[lastPageIndex].messages, optimisticMessage]
        };
        
        return {
          ...old,
          pages: newPages
        };
      });
      
      // Return context for potential rollback
      return { optimisticId };
    },
    onError: (err, variables, context) => {
      // Remove failed optimistic message
      if (context?.optimisticId) {
        queryClient.setQueryData<MessagesInfiniteData>(['messages', conversationId], (old: MessagesInfiniteData | undefined) => {
          if (!old) return old;
          
          const newPages = old.pages.map((page: MessagePage) => ({
            ...page,
            messages: page.messages.filter((msg: Message) => msg.id !== context.optimisticId)
          }));
          
          return {
            ...old,
            pages: newPages
          };
        });
      }
      
      addToast(`Error sending message: ${err.message}`, 'error');
    },
  });

  // Mark messages as seen
  const markAsSeenMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const res = await fetch(`/api/conversations/${conversationId}/messages/${messageId}/seen`, {
        method: 'POST',
      });
      
      if (!res.ok) {
        throw new Error('Failed to mark message as seen');
      }
      
      return res.json();
    },
  });

  // Flatten all pages of messages into a single array
  const allMessages = messagesData?.pages.flatMap(page => page.messages) || [];
  
  return {
    messagesData,
    allMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    sendMessageMutation,
    markAsSeenMutation,
    queryClient
  };
};
