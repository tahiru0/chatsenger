import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import FriendRequestModal from '../friends/FriendRequestModal';
import Logo from '../ui/Logo';
import SettingsModal from '../settings/SettingsModal';
import { FiPlus, FiSearch, FiSettings } from 'react-icons/fi';
import { FaUserPlus } from 'react-icons/fa';

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

type Props = {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export default function ConversationList({ conversations, selectedId, onSelect }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fetch friend requests
  const { data: friendRequestsData } = useQuery({
    queryKey: ['friendRequests'],
    queryFn: async () => {
      const res = await fetch("/api/friends/requests");
      if (!res.ok) throw new Error("Failed to fetch friend requests");
      return res.json();
    },
  });

  const pendingRequests = friendRequestsData?.requests || [];
  
  // Filter conversations by search query
  const filteredConversations = conversations.filter((conversation) => {
    if (!searchQuery) return true;
    
    // Search by conversation name or participant names
    return (
      conversation.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.participants.some(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-base-200">
        <div className="flex items-center justify-between mb-4">
          <Logo size="small" showText={true} />
          <div className="flex gap-2">
            <button 
              className="btn btn-circle btn-sm btn-ghost text-base-content" 
              onClick={() => setIsModalOpen(true)}
            >
              <FiPlus className="w-5 h-5" />
            </button>
            {pendingRequests.length > 0 && (
              <div className="indicator">
                <span className="indicator-item badge badge-primary badge-xs">{pendingRequests.length}</span>
                <button className="btn btn-circle btn-sm btn-ghost text-base-content">
                  <FaUserPlus className="w-5 h-5" />
                </button>
              </div>
            )}
            {/* Settings button */}
            <button 
              className="btn btn-circle btn-sm btn-ghost text-base-content" 
              onClick={() => setIsSettingsOpen(true)}
            >
              <FiSettings className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            className="input input-bordered w-full pl-10 text-base-content"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <FiSearch className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50" />
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-4 border-b border-base-300 cursor-pointer hover:bg-base-200 ${
                selectedId === conversation.id ? "bg-base-200" : ""
              }`}
              onClick={() => onSelect(conversation.id)}
            >
              <div className="flex items-center gap-3">
                <div className="avatar placeholder">
                  <div className="bg-neutral text-neutral-content rounded-full w-12">
                    <span>{conversation.name?.[0] || conversation.participants[0]?.name[0] || '?'}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate text-base-content">
                    {conversation.name || conversation.participants.map(p => p.name).join(', ')}
                  </h3>
                  {conversation.lastMessage && (
                    <p className="text-sm text-base-content/70 truncate">
                      {conversation.lastMessage.content}
                    </p>
                  )}
                </div>
                {conversation.lastMessage && (
                  <div className="text-xs text-base-content/60">
                    {new Date(conversation.lastMessage.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-base-content/60">
            {searchQuery ? "No conversations found" : "No conversations yet"}
          </div>
        )}
      </div>
      
      <FriendRequestModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
      
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
