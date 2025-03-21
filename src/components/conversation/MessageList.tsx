import { useRef, useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Message } from '@/types/chat';

type MessageListProps = {
  messages: Message[];
  userId: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  status: string;
  isLoadingMore: boolean;
  setIsLoadingMore: (value: boolean) => void;
  fetchNextPage: () => Promise<unknown>;
  searchQuery: string;
};

export const MessageList = ({
  messages,
  userId,
  hasNextPage,
  isFetchingNextPage,
  status,
  isLoadingMore,
  setIsLoadingMore,
  fetchNextPage,
  searchQuery
}: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const lastScrollHeightRef = useRef<number>(0);
  const lastScrollPositionRef = useRef<number>(0);
  const prevMessagesLengthRef = useRef<number>(0);
  const [allImagesLoaded, setAllImagesLoaded] = useState(true);
  const [pendingImagesCount, setPendingImagesCount] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [hasContent, setHasContent] = useState(false); // Track if content has been rendered
  
  // Filter messages by search query
  const filteredMessages = messages.filter(message => 
    !searchQuery || message.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Track when content has been rendered
  useEffect(() => {
    if (filteredMessages.length > 0 && !hasContent) {
      setHasContent(true);
    }
  }, [filteredMessages.length, hasContent]);

  // Track images that are currently loading
  useEffect(() => {
    if (messages.length === 0) return;
    
    // Reset loaded images tracker when messages change significantly
    if (Math.abs(messages.length - prevMessagesLengthRef.current) > 1) {
      setLoadedImages({});
    }
    
    // Count GIF messages that need to be loaded
    const gifMessages = messages.filter(message => message.gifUrl);
    const notYetLoadedGifs = gifMessages.filter(message => 
      !loadedImages[`${message.id}-${message.gifUrl}`]
    );
    
    setPendingImagesCount(notYetLoadedGifs.length);
    
    // Consider all images loaded if there are no GIFs to load
    setAllImagesLoaded(notYetLoadedGifs.length === 0);
    
    // Update reference for scroll detection
    prevMessagesLengthRef.current = messages.length;
  }, [messages, loadedImages]);

  // Handle image load event
  const handleImageLoaded = useCallback((messageId: number | string, gifUrl?: string) => {
    if (!gifUrl) return;
    
    // Mark this specific GIF as loaded
    setLoadedImages(prev => ({
      ...prev, 
      [`${messageId}-${gifUrl}`]: true
    }));
    
    // Decrease pending count
    setPendingImagesCount(prev => {
      const newCount = Math.max(0, prev - 1);
      if (newCount <= 0) {
        setAllImagesLoaded(true);
      }
      return newCount;
    });
  }, []);

  // Check if should auto-scroll when new messages come in
  const shouldAutoScroll = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    // Auto-scroll if user is already near the bottom (within 150px) or if it's a new message from the user
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    const latestMessageId = messages[messages.length - 1]?.id;
    const isNewUserMessage = latestMessageId && 
                          (typeof latestMessageId === 'string' && latestMessageId.startsWith('temp-')) || 
                          messages[messages.length - 1]?.senderId === parseInt(userId);
    
    return isNearBottom || isNewUserMessage;
  }, [messages, userId]);
  
  // Setup Intersection Observer for infinite scrolling
  useEffect(() => {
    if (!loadingRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          // Save current scroll position before loading more
          if (messagesContainerRef.current) {
            lastScrollHeightRef.current = messagesContainerRef.current.scrollHeight;
            lastScrollPositionRef.current = messagesContainerRef.current.scrollTop;
          }
          setIsLoadingMore(true);
          fetchNextPage().finally(() => setIsLoadingMore(false));
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, setIsLoadingMore]);

  // Maintain scroll position when loading more messages
  useEffect(() => {
    if (isLoadingMore && messagesContainerRef.current && lastScrollHeightRef.current) {
      const newScrollHeight = messagesContainerRef.current.scrollHeight;
      const heightDifference = newScrollHeight - lastScrollHeightRef.current;
      messagesContainerRef.current.scrollTop = lastScrollPositionRef.current + heightDifference;
    }
  }, [messages, isLoadingMore]);

  // Initial scroll to bottom when component mounts and content is available
  useEffect(() => {
    if (hasContent && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView();
    }
  }, [hasContent]);

  // Force scroll to bottom when the first batch of messages loads
  useEffect(() => {
    if (status === 'success' && filteredMessages.length > 0 && messagesEndRef.current) {
      // Use a short delay to ensure the DOM has been updated
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [status, filteredMessages.length]);

  // Scroll to bottom when all images are loaded and new messages arrive
  useEffect(() => {
    // Don't auto-scroll when loading history
    if (isLoadingMore || isFetchingNextPage) return;
    
    // If all images are loaded and we should auto-scroll
    if (allImagesLoaded && shouldAutoScroll() && messagesEndRef.current) {
      // Use a small timeout to ensure DOM has finished updating
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, [allImagesLoaded, isLoadingMore, isFetchingNextPage, shouldAutoScroll]);

  // Render GIF in message with loading handling
  const renderMessageContent = (message: Message) => {
    if (message.gifUrl) {
      const imageKey = `${message.id}-${message.gifUrl}`;
      const isThisImageLoaded = loadedImages[imageKey];
      
      return (
        <div className="relative">
          {!isThisImageLoaded && (
            <div className="flex justify-center items-center h-24 mb-1 bg-base-300 rounded-lg animate-pulse">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          )}
          <img 
            src={message.gifUrl} 
            alt="GIF" 
            className={`rounded-lg max-w-full h-auto max-h-60 mb-1 ${!isThisImageLoaded ? 'hidden' : ''}`}
            onLoad={() => handleImageLoaded(message.id, message.gifUrl)}
            onError={() => handleImageLoaded(message.id, message.gifUrl)} // Also handle errors
                      />
          <div className="text-xs opacity-70">{message.content}</div>
        </div>
      );
    }
    
    return message.content;
  };

  return (
    <div 
      className="flex-1 p-4 overflow-y-auto bg-base-100"
      ref={messagesContainerRef}
    >
      {/* Loading indicator for older messages */}
      {(isFetchingNextPage || status === 'pending') ? (
        <div className="flex justify-center py-2">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      ) : hasNextPage ? (
        <div 
          ref={loadingRef}
          className="h-1 w-full opacity-0"
          aria-hidden="true"
        ></div>
      ) : (
        <div className="text-center py-1 text-xs text-base-content/50">
          Beginning of conversation
        </div>
      )}
      
      {/* Message list */}
      {filteredMessages.length > 0 ? (
        filteredMessages.map((message, index) => {
          const isCurrentUser = message.senderId === parseInt(userId);
          const showDate = index === 0 || new Date(message.createdAt).toDateString() !== 
            new Date(filteredMessages[index - 1].createdAt).toDateString();
          
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
                  {renderMessageContent(message)}
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
      
      {/* Loading indicator for images - now fixed at bottom */}
      {!allImagesLoaded && pendingImagesCount > 0 && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-10">
          <div className="badge badge-neutral gap-2">
            <span className="loading loading-spinner loading-xs"></span>
            Loading media...
          </div>
        </div>
      )}
    </div>
  );
};
