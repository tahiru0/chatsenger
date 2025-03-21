import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiCheck, FiX, FiSearch, FiUserPlus } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/providers/ToastProvider';
import debounce from 'lodash.debounce';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type FriendRequest = {
  id: number;
  createdAt: string;
  sender: {
    id: number;
    name: string;
    phone: string;
  };
};

// Add outgoing request type definition
type OutgoingFriendRequest = {
  id: number;
  createdAt: string;
  recipient: {
    id: number;
    name: string;
    phone: string;
  };
};

type UserSearchResult = {
  id: number;
  name: string;
  phone: string;
};

export default function FriendRequestModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'add' | 'requests'>('add');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<UserSearchResult | null>(null);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // Fetch friend requests
  const { data: friendRequestsData, isLoading } = useQuery({
    queryKey: ['friendRequests'],
    queryFn: async () => {
      const res = await fetch('/api/friends/requests');
      if (!res.ok) throw new Error('Failed to fetch friend requests');
      return res.json();
    },
    enabled: isOpen,
  });
  
  const incomingRequests: FriendRequest[] = friendRequestsData?.requests?.incoming || [];
  const outgoingRequests: OutgoingFriendRequest[] = friendRequestsData?.requests?.outgoing || [];

  // Search user mutation
  const searchUserMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await fetch(`/api/users/search?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'User not found');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setFoundUser(data.user);
      setError(null);
    },
    onError: (error: Error) => {
      setFoundUser(null);
      setError(error.message);
      
      // Show toast with helpful error message
      if (error.message.includes("already pending")) {
        addToast("A friend request for this user is already pending", 'info');
      } else if (error.message.includes("Already friends")) {
        addToast("You are already friends with this user", 'info');
      } else if (error.message === 'Cannot add yourself as a friend') {
        addToast("You cannot add yourself as a friend", 'warning');
      }
    },
  });

  // Send friend request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to send friend request');
      }

      return res.json();
    },
    onSuccess: () => {
      addToast('Friend request sent successfully!', 'success');
      setPhoneNumber('');
      setError(null);
      setFoundUser(null);
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
    },
    onError: (error: Error) => {
      setError(error.message);
      addToast(error.message, 'error');
    },
  });

  // Handle friend request action (accept/reject)
  const friendRequestActionMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: number; action: 'accept' | 'reject' }) => {
      const res = await fetch('/api/friends/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId, action }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to process friend request');
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      const action = variables.action;
      addToast(`Friend request ${action === 'accept' ? 'accepted' : 'rejected'}!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (error: Error) => {
      addToast(error.message, 'error');
    },
  });

  // Debounced search function
  const debouncedSearch = debounce((phone: string) => {
    if (phone.length >= 10) {
      searchUserMutation.mutate(phone);
    } else {
      setFoundUser(null);
    }
  }, 500);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhoneNumber(value);
    debouncedSearch(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }
    
    if (!foundUser) {
      setError('User not found. Please check the phone number.');
      return;
    }
    
    setError(null);
    sendRequestMutation.mutate(phoneNumber.trim());
  };

  const handleRequestAction = (requestId: number, action: 'accept' | 'reject') => {
    friendRequestActionMutation.mutate({ requestId, action });
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-base-content">Friend Requests</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost text-base-content"
            onClick={onClose}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        
        <div className="tabs tabs-boxed mb-4 bg-base-200">
          <button
            className={`tab ${activeTab === 'add' ? 'tab-active' : ''} text-base-content`}
            onClick={() => setActiveTab('add')}
          >
            Add Friend
          </button>
          <button
            className={`tab ${activeTab === 'requests' ? 'tab-active' : ''} text-base-content`}
            onClick={() => setActiveTab('requests')}
          >
            Pending Requests
            {incomingRequests.length > 0 && (
              <span className="badge badge-primary badge-sm ml-1">
                {incomingRequests.length}
              </span>
            )}
          </button>
        </div>
        
        {activeTab === 'add' && (
          <form onSubmit={handleSubmit}>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-base-content/80">Phone Number</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  className="input input-bordered w-full pr-10 text-base-content"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                />
                {searchUserMutation.isPending && (
                  <span className="absolute inset-y-0 right-3 flex items-center">
                    <span className="loading loading-spinner loading-xs"></span>
                  </span>
                )}
              </div>
              {error && (
                <label className="label">
                  <span className="label-text-alt text-error">{error}</span>
                </label>
              )}
            </div>
            
            {/* Show user card when found */}
            {foundUser && (
              <div className="mt-4 p-4 border border-base-300 rounded-lg bg-base-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-base-content">{foundUser.name}</h4>
                    <p className="text-sm text-base-content/70">{foundUser.phone}</p>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary"
                    disabled={sendRequestMutation.isPending}
                  >
                    {sendRequestMutation.isPending ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      <>
                        <FiUserPlus className="mr-1 h-4 w-4" />
                        Add Friend
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {!foundUser && phoneNumber && !searchUserMutation.isPending && (
              <div className="mt-4 p-4 border border-base-300 rounded-lg bg-base-200 text-center">
                <p className="text-base-content/70">
                  {error || 'No user found with this phone number.'}
                </p>
                <p className="text-xs text-base-content/50 mt-1">
                  Make sure the phone number is correct.
                </p>
              </div>
            )}
            
            {!phoneNumber && (
              <div className="mt-4 p-4 border border-base-300 rounded-lg bg-base-200 text-center">
                <div className="flex flex-col items-center justify-center text-base-content/70">
                  <FiSearch className="h-8 w-8 mb-2 opacity-50" />
                  <p>Enter a phone number to find a friend</p>
                </div>
              </div>
            )}
            
            <div className="modal-action">
              <button 
                type="button" 
                className="btn bg-base-300 text-base-content hover:bg-base-200"
                onClick={onClose}
              >
                Cancel
              </button>
              {!foundUser && (
                <button 
                  type="button" 
                  className="btn btn-primary"
                  disabled={!phoneNumber || searchUserMutation.isPending}
                  onClick={() => searchUserMutation.mutate(phoneNumber)}
                >
                  {searchUserMutation.isPending ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    'Search'
                  )}
                </button>
              )}
            </div>
          </form>
        )}
        
        {activeTab === 'requests' && (
          <div>
            <h4 className="font-medium text-base-content mb-2">Incoming Requests</h4>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : incomingRequests.length > 0 ? (
              <div className="space-y-3 mb-6">
                {incomingRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between bg-base-200 p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-base-content">{request.sender.name}</p>
                      <p className="text-sm text-base-content/70">{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        className="btn btn-sm btn-circle btn-success"
                        onClick={() => handleRequestAction(request.id, 'accept')}
                        disabled={friendRequestActionMutation.isPending}
                      >
                        <FiCheck className="w-4 h-4" />
                      </button>
                      <button 
                        className="btn btn-sm btn-circle btn-error"
                        onClick={() => handleRequestAction(request.id, 'reject')}
                        disabled={friendRequestActionMutation.isPending}
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-base-content/60">
                No incoming friend requests
              </div>
            )}

            <h4 className="font-medium text-base-content mb-2">Outgoing Requests</h4>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : outgoingRequests.length > 0 ? (
              <div className="space-y-3">
                {outgoingRequests.map((request: OutgoingFriendRequest) => (
                  <div key={request.id} className="flex items-center justify-between bg-base-200 p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-base-content">{request.recipient.name}</p>
                      <p className="text-sm text-base-content/70">{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</p>
                    </div>
                    <div className="text-sm text-base-content/70">Pending</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-base-content/60">
                No outgoing friend requests
              </div>
            )}

            <div className="modal-action">
              <button 
                className="btn bg-base-300 text-base-content hover:bg-base-200"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="modal-backdrop bg-base-300/50" onClick={onClose}></div>
    </div>
  );
}
