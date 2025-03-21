import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pusherClient, CHANNELS, EVENTS } from '@/lib/pusher';
import { FiSearch, FiInfo, FiX } from 'react-icons/fi';

type Message = {
  id: number;
  content: string;
  senderId: number;
  createdAt: string;
  status: 'sent' | 'delivered' | 'seen';
  sender: {
    id: number;
    name: string;
  };
};

type Conversation = {
  id: number;
  name: string | null;
  participants: {
    id: number;
    name: string;
  }[];
};

type MessagesData = {
  messages: Message[];
};

type Props = {
  conversationId: number;
  userId: string;
};

export default function ChatView({ conversationId, userId }: Props) {
  const [messageInput, setMessageInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversation details
  const { data: conversationData } = useQuery<{ conversation: Conversation }>({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) throw new Error('Failed to fetch conversation');
      return res.json();
    },
  });

  // Fetch messages
  const { data: messagesData } = useQuery<MessagesData>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to send message');
      }
      
      return res.json();
    },
    onSuccess: (newMessage) => {
      queryClient.setQueryData<MessagesData>(['messages', conversationId], (old) => ({
        messages: [...(old?.messages || []), newMessage],
      }));
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

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = pusherClient.subscribe(`${CHANNELS.CONVERSATION}-${conversationId}`);
    
    channel.bind(EVENTS.NEW_MESSAGE, (message: Message) => {
      // Add new message to the list
      queryClient.setQueryData<MessagesData>(['messages', conversationId], (old) => ({
        messages: [...(old?.messages || []), message],
      }));
      
      // Mark message as seen if it's not from the current user
      if (message.senderId !== parseInt(userId)) {
        markAsSeenMutation.mutate(message.id);
      }
    });
    
    channel.bind(EVENTS.MESSAGE_SEEN, ({ messageId }: { messageId: number, userId: number }) => {
      // Update message status in the list
      queryClient.setQueryData<MessagesData>(['messages', conversationId], (old) => {
        if (!old) return { messages: [] };
        
        return {
          messages: old.messages.map((msg: Message) => 
            msg.id === messageId ? { ...msg, status: 'seen' } : msg
          ),
        };
      });
    });
    
    return () => {
      pusherClient.unsubscribe(`${CHANNELS.CONVERSATION}-${conversationId}`);
    };
  }, [conversationId, userId, queryClient, markAsSeenMutation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData?.messages]);

  // Handle message submission
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    
    sendMessageMutation.mutate(messageInput.trim());
    setMessageInput('');
  };

  // Filter messages by search query
  const filteredMessages = messagesData?.messages.filter(message => 
    !searchQuery || message.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-base-300 bg-base-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-10">
              <span>
                {conversationData?.conversation.name?.[0] || 
                 conversationData?.conversation.participants[0]?.name[0] || 
                 '?'}
              </span>
            </div>
          </div>
          <div>
            {/* Thêm class text-base-content để thích ứng với theme */}
            <h2 className="font-medium text-base-content">
              {conversationData?.conversation.name || 
               conversationData?.conversation.participants.map(p => p.name).join(', ')}
            </h2>
            {/* Cập nhật opacity bằng class text-base-content/50 */}
            <p className="text-xs text-base-content/60">
              {conversationData?.conversation.participants.length} participants
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSearching ? (
            <div className="join">
              <input
                type="text"
                placeholder="Search messages..."
                className="input input-sm input-bordered join-item text-base-content"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button 
                className="btn btn-sm join-item"
                onClick={() => {
                  setIsSearching(false);
                  setSearchQuery('');
                }}
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-circle btn-sm btn-ghost text-base-content"
              onClick={() => setIsSearching(true)}
            >
              <FiSearch className="w-5 h-5" />
            </button>
          )}
          <button className="btn btn-circle btn-sm btn-ghost text-base-content">
            <FiInfo className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto bg-base-100">
        {filteredMessages?.length ? (
          filteredMessages.map((message, index) => {
            const isCurrentUser = message.senderId === parseInt(userId);
            const showDate = index === 0 || new Date(message.createdAt).toDateString() !== new Date(filteredMessages[index - 1].createdAt).toDateString();
            
            return (
              <div key={message.id}>
                {showDate && (
                  <div className="text-center my-4">
                    <span className="badge badge-neutral text-neutral-content">
                      {format(new Date(message.createdAt), 'MMMM d, yyyy')}
                    </span>
                  </div>
                )}
                <div className={`chat ${isCurrentUser ? 'chat-end' : 'chat-start'} mb-2`}>
                  <div className="chat-header">
                    {!isCurrentUser && <span className="text-xs text-base-content/70">{message.sender.name}</span>}
                    <time className="text-xs text-base-content/60 ml-1">
                      {format(new Date(message.createdAt), 'h:mm a')}
                    </time>
                  </div>
                  <div className={`chat-bubble ${isCurrentUser ? 'chat-bubble-primary text-primary-content' : 'text-base-content'}`}>
                    {message.content}
                  </div>
                  {isCurrentUser && (
                    <div className="chat-footer text-base-content/60 text-xs">
                      {message.status === 'seen' ? 'Seen' : message.status}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center h-full text-base-content/60">
            {searchQuery 
              ? "No messages found" 
              : "No messages yet. Send one to start the conversation!"}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      <div className="p-4 border-t border-base-300 bg-base-200">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            className="input input-bordered flex-1"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
          />
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={!messageInput.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
