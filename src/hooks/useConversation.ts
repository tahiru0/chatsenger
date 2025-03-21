import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/providers/ToastProvider';
import { Conversation } from '@/types/chat';

export const useConversation = (conversationId: number) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Fetch conversation details
  const { data: conversationData } = useQuery<{ conversation: Conversation }>({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) throw new Error('Failed to fetch conversation');
      return res.json();
    },
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error('Failed to delete conversation');
      }
      
      return res.json();
    },
    onSuccess: () => {
      addToast('Conversation deleted', 'success');
      // Refetch conversations
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      addToast(`Error: ${error.message}`, 'error');
    },
  });

  // Update conversation name mutation
  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/conversations/${conversationId}/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to update conversation name');
      }
      
      return res.json();
    },
    onSuccess: () => {
      addToast('Conversation name updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      addToast(`Error: ${error.message}`, 'error');
    },
  });

  // Helper function to get conversation name
  const getConversationName = () => {
    if (!conversationData) return '';
    
    if (conversationData.conversation.name) {
      return conversationData.conversation.name;
    }
    
    // For direct messages, use the other person's name
    if (conversationData.conversation.participants.length === 1) {
      return conversationData.conversation.participants[0].name;
    }
    
    // For group chats, join everyone's names
    return conversationData.conversation.participants.map(p => p.name).join(', ');
  };

  return {
    conversationData,
    getConversationName,
    deleteConversationMutation,
    updateNameMutation
  };
};
