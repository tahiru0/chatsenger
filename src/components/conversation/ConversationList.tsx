import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import FriendRequestModal from '../friends/FriendRequestModal';
import FriendList from '../friends/FriendList';
import Logo from '../ui/Logo';
import SettingsModal from '../settings/SettingsModal';
import UserProfileModal from '../settings/UserProfileModal';
import { FiPlus, FiSearch, FiSettings, FiMessageSquare, FiUserPlus, FiUsers, FiTool, FiLogOut, FiUser } from 'react-icons/fi';

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

type OnlineFriend = {
  id: number;
  name: string;
  isOnline: boolean;
  lastSeen?: string;
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'chats' | 'friends' | 'requests'>('chats');
  const [userData, setUserData] = useState<{id: number, name: string, phone: string} | null>(null);
  
  // Fetch friend requests
  const { data: friendRequestsData } = useQuery({
    queryKey: ['friendRequests'],
    queryFn: async () => {
      const res = await fetch("/api/friends/requests");
      if (!res.ok) throw new Error("Failed to fetch friend requests");
      return res.json();
    },
  });

  // Fetch online friends
  const { data: onlineFriendsData } = useQuery({
    queryKey: ['onlineFriends'],
    queryFn: async () => {
      const res = await fetch("/api/friends/online");
      if (!res.ok) throw new Error("Failed to fetch online friends");
      return res.json();
    },
    refetchInterval: 30000, // Check online status every 30 seconds
  });

  const onlineFriends: OnlineFriend[] = onlineFriendsData?.friends || [];
  const pendingRequests = friendRequestsData?.requests?.incoming || [];
  
  // Fetch current user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUserData(data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user data', error);
      }
    };
    
    fetchUserData();
  }, []);

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

  // Sort conversations by last message time (newest first)
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return timeB - timeA; // Newest first
  });

  // Helper function to get conversation display name
  const getConversationName = (conversation: Conversation) => {
    // If there's a custom name set, use it
    if (conversation.name) return conversation.name;
    
    // If no name, use participants names
    if (conversation.participants.length === 1) {
      // For direct messages, use the other person's name
      return conversation.participants[0].name;
    } else if (conversation.participants.length > 1) {
      // For group chats, join names (up to 3)
      return conversation.participants
        .slice(0, 3)
        .map(p => p.name)
        .join(', ') + 
        (conversation.participants.length > 3 ? ` and ${conversation.participants.length - 3} more` : '');
    }
    
    return 'New Conversation';
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'friends':
        return <FriendList onSelectConversation={handleSelectConversation} />;
      case 'requests':
        // Directly open the friend request modal on the requests tab
        setIsModalOpen(true);
        setActiveSection('chats');
        return renderChats();
      case 'chats':
      default:
        return renderChats();
    }
  };

  const handleSelectConversation = (conversationId: number) => {
    onSelect(conversationId);
    setActiveSection('chats'); // Chuyển về tab chat khi chọn một cuộc trò chuyện
  };

  const renderChats = () => (
    <>
      <div className="p-4 bg-base-200">
        <div className="flex items-center justify-between mb-4">
          <Logo size="small" showText={true} />
          <div className="flex gap-2">
            <button
              id="add-friend-button" 
              className="btn btn-circle btn-sm btn-ghost text-base-content" 
              onClick={() => setIsModalOpen(true)}
            >
              <FiPlus className="w-5 h-5" />
            </button>
            {pendingRequests.length > 0 && (
              <div className="indicator">
                <span className="indicator-item badge badge-primary badge-xs">{pendingRequests.length}</span>
                <button 
                  className="btn btn-circle btn-sm btn-ghost text-base-content"
                  onClick={() => setIsModalOpen(true)}
                >
                  <FiUserPlus className="w-5 h-5" />
                </button>
              </div>
            )}
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

      {/* Online Friends Avatar Row */}
      <div className="px-4 py-2 border-b border-base-300 overflow-x-auto">
        <div className="flex gap-3 items-center">
          <div className="font-medium text-xs text-base-content/70">Online</div>
          <div className="flex gap-2 items-center">
            {onlineFriends.length > 0 ? (
              onlineFriends
                .filter(friend => friend.isOnline) // Chỉ hiển thị bạn bè đang online
                .map((friend) => (
                  <div key={friend.id} className="avatar indicator">
                    <div className="w-8 h-8 rounded-full bg-neutral text-neutral-content flex items-center justify-center">
                      <span className="text-xs">{friend.name[0]}</span>
                      <span className="indicator-item badge badge-xs badge-success"></span>
                    </div>
                  </div>
                ))
            ) : (
              <span className="text-xs text-base-content/50">No friends online</span>
            )}
            
            {/* Hiển thị số bạn bè đang offline nếu có */}
            {onlineFriends.filter(friend => !friend.isOnline).length > 0 && (
              <div className="text-xs text-base-content/50 ml-2">
                +{onlineFriends.filter(friend => !friend.isOnline).length} offline
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {sortedConversations.length > 0 ? (
          sortedConversations.map((conversation) => (
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
                    <span>
                      {conversation.name?.[0] || 
                      conversation.participants[0]?.name[0] || '?'}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center w-full">
                    <h3 className="font-medium truncate text-base-content">
                      {getConversationName(conversation)}
                    </h3>
                    {conversation.lastMessage && (
                      <div className="text-xs text-base-content/60">
                        {new Date(conversation.lastMessage.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                  {conversation.lastMessage && (
                    <p className="text-sm text-base-content/70 truncate">
                      {conversation.lastMessage.content}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-base-content/60">
            {searchQuery ? "No conversations found" : "No conversations yet"}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-full">
      {/* Side Nav with User Avatar */}
      <div className="w-16 flex flex-col items-center py-4 border-r border-base-300 bg-base-200">
        {/* Top Navigation Items */}
        <button 
          className={`btn btn-ghost mb-2 ${activeSection === 'chats' ? 'btn-active' : ''} text-base-content`}
          onClick={() => setActiveSection('chats')}
        >
          <FiMessageSquare className="h-5 w-5" />
        </button>
        <button 
          className={`btn btn-ghost mb-2 ${activeSection === 'requests' ? 'btn-active' : ''} text-base-content`}
          onClick={() => setIsModalOpen(true)}
        >
          <FiUserPlus className="h-5 w-5" />
          {pendingRequests.length > 0 && (
            <span className="absolute top-0 right-0 badge badge-primary badge-xs">{pendingRequests.length}</span>
          )}
        </button>
        <button 
          className={`btn btn-ghost mb-2 ${activeSection === 'friends' ? 'btn-active' : ''} text-base-content`}
          onClick={() => setActiveSection('friends')}
        >
          <FiUsers className="h-5 w-5" />
        </button>
        <button className="btn btn-ghost mb-2 text-base-content">
          <FiTool className="h-5 w-5" />
        </button>
        
        {/* Spacer to push user avatar to bottom */}
        <div className="flex-grow"></div>
        
        {/* User Profile Avatar */}
        <div className="mt-auto mb-2">
          <div className="dropdown dropdown-top">
            <div tabIndex={0} role="button" className="avatar placeholder cursor-pointer hover:opacity-80 transition-opacity">
              <div className="bg-primary text-primary-content rounded-full w-10 h-10">
                <span>
                  {userData?.name?.charAt(0) || '?'}
                </span>
              </div>
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
              <li><a onClick={() => setIsProfileOpen(true)}><FiUser />Profile</a></li>
              <li><a onClick={() => setIsSettingsOpen(true)}><FiSettings />Settings</a></li>
              <li>
                <a onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  window.location.reload();
                }}><FiLogOut />Logout</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {renderContent()}
        
        <FriendRequestModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
        
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />

        <UserProfileModal 
          isOpen={isProfileOpen} 
          onClose={() => setIsProfileOpen(false)}
          userData={userData}
        />
      </div>
    </div>
  );
}
