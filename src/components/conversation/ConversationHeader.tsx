import { useState, useEffect } from 'react';
import { FiSearch, FiInfo, FiX, FiTrash2, FiEdit } from 'react-icons/fi';
import { useConversation } from '@/hooks/useConversation';

type ConversationHeaderProps = {
  conversationId: number;
  isSearching: boolean;
  setIsSearching: (value: boolean) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
};

export const ConversationHeader = ({
  conversationId,
  isSearching,
  setIsSearching,
  searchQuery,
  setSearchQuery
}: ConversationHeaderProps) => {
  const { conversationData, getConversationName, deleteConversationMutation, updateNameMutation } = useConversation(conversationId);
  const [isEditingName, setIsEditingName] = useState(false);
  const [conversationName, setConversationName] = useState('');
  
  // Set initial conversation name
  useEffect(() => {
    if (conversationData) {
      const name = getConversationName();
      setConversationName(name);
    }
  }, [conversationData]);
  
  // Handle name update
  const handleNameUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (conversationName.trim()) {
      updateNameMutation.mutate(conversationName.trim());
    } else {
      // If name is empty, use default name
      const defaultName = getConversationName();
      updateNameMutation.mutate('');
      setConversationName(defaultName);
    }
    setIsEditingName(false);
  };
  
  // Confirm and delete conversation
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      deleteConversationMutation.mutate();
    }
  };

  return (
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
        {isEditingName ? (
          <form onSubmit={handleNameUpdate} className="join">
            <input
              type="text"
              value={conversationName}
              onChange={(e) => setConversationName(e.target.value)}
              className="input input-bordered input-sm join-item"
              placeholder="Enter conversation name"
              autoFocus
            />
            <button 
              type="submit" 
              className="btn btn-sm join-item"
              disabled={updateNameMutation.isPending}
            >
              {updateNameMutation.isPending ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                'Save'
              )}
            </button>
            <button 
              type="button" 
              className="btn btn-sm join-item"
              onClick={() => {
                setIsEditingName(false);
                setConversationName(getConversationName());
              }}
            >
              <FiX className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-base-content">
              {getConversationName()}
            </h2>
            <button 
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => setIsEditingName(true)}
            >
              <FiEdit className="w-3 h-3" />
            </button>
          </div>
        )}
        <p className="text-xs text-base-content/60">
          {conversationData?.conversation.participants.length} participants
        </p>
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
        <button 
          className="btn btn-circle btn-sm btn-ghost text-base-content"
          onClick={handleDelete}
          disabled={deleteConversationMutation.isPending}
        >
          {deleteConversationMutation.isPending ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            <FiTrash2 className="w-5 h-5" />
          )}
        </button>
        <button className="btn btn-circle btn-sm btn-ghost text-base-content">
          <FiInfo className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
