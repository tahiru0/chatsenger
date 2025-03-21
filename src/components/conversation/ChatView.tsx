import { useState, useEffect } from 'react';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatRealtime } from '@/hooks/useChatRealtime';
import { GiphyGif } from '@/types/giphy';

type Props = {
  conversationId: number;
  userId: string;
};

export default function ChatView({ conversationId, userId }: Props) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Fetch messages and get related mutations
  const {
    allMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    sendMessageMutation,
    markAsSeenMutation
  } = useChatMessages(conversationId, userId);
  
  // Setup realtime updates
  useChatRealtime(conversationId, userId, markAsSeenMutation);
  
  // Force scroll to bottom when sending a new message
  // We keep this effect to ensure that even if the GIF is still loading,
  // we indicate to the user that their message is being sent
  useEffect(() => {
    if (isSending) {
      // The MessageList component will handle the actual scrolling
      // based on allImagesLoaded state
    }
  }, [isSending]);
  
  // Handle sending text message
  const handleSendMessage = (text: string) => {
    setIsSending(true);
    sendMessageMutation.mutate({ text }, {
      onSettled: () => {
        setIsSending(false);
      }
    });
  };
  
  // Handle sending GIF with proper typing
  const handleSendGif = (gif: GiphyGif) => {
    setIsSending(true);
    sendMessageMutation.mutate({
      text: gif.title || "Sent a GIF",
      gifUrl: gif.images.original.url
    }, {
      onSettled: () => {
        setIsSending(false);
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ConversationHeader
        conversationId={conversationId}
        isSearching={isSearching}
        setIsSearching={setIsSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      
      {/* Messages */}
      <MessageList
        messages={allMessages}
        userId={userId}
        hasNextPage={hasNextPage || false}
        isFetchingNextPage={isFetchingNextPage}
        status={status}
        isLoadingMore={isLoadingMore}
        setIsLoadingMore={setIsLoadingMore}
        fetchNextPage={fetchNextPage}
        searchQuery={searchQuery}
      />
      
      {/* Message input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onSendGif={handleSendGif}
        isSending={isSending}
      />
    </div>
  );
}
