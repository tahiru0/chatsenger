import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FiMessageSquare } from 'react-icons/fi';
import { useToast } from '@/providers/ToastProvider';

type Friend = {
  id: number;
  name: string;
  phone: string;
};

type Props = {
  onSelectConversation?: (conversationId: number) => void;
};

export default function FriendList({ onSelectConversation }: Props) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // Fetch friends
  const { data, isLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const res = await fetch('/api/friends');
      if (!res.ok) throw new Error('Failed to fetch friends');
      return res.json();
    },
  });

  const friends: Friend[] = data?.friends || [];

  // Kiểm tra và mở cuộc trò chuyện với một người bạn
  const startConversationMutation = useMutation({
    mutationFn: async (friendId: number) => {
      // Đầu tiên, kiểm tra xem cuộc trò chuyện đã tồn tại chưa
      const checkRes = await fetch(`/api/conversations/check?friendId=${friendId}`);
      
      if (!checkRes.ok) {
        const errorData = await checkRes.json();
        throw new Error(errorData.error || 'Failed to check existing conversation');
      }
      
      const checkData = await checkRes.json();
      
      // Nếu đã có cuộc trò chuyện, trả về cuộc trò chuyện đó
      if (checkData.exists) {
        return { conversation: checkData.conversation, isNew: false };
      }
      
      // Nếu chưa có, tạo cuộc trò chuyện mới
      const createRes = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ participantIds: [friendId] }),
      });

      if (!createRes.ok) {
        const errorData = await createRes.json();
        throw new Error(errorData.error || 'Failed to create conversation');
      }
      
      const createData = await createRes.json();
      return { conversation: createData.conversation, isNew: true };
    },
    onSuccess: (data) => {
      if (data.isNew) {
        addToast('Conversation created!', 'success');
      }
      
      // Cập nhật danh sách cuộc trò chuyện
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      
      // Chuyển sang hiển thị cuộc trò chuyện
      if (onSelectConversation && data.conversation?.id) {
        onSelectConversation(data.conversation.id);
      }
    },
    onError: (error: Error) => {
      addToast(error.message, 'error');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-base-content mb-4">Friends</h2>
      
      {friends.length > 0 ? (
        <div className="space-y-4">
          {friends.map((friend) => (
            <div key={friend.id} className="flex items-center justify-between bg-base-200 p-4 rounded-lg">
              <div>
                <p className="font-medium text-base-content">{friend.name}</p>
                <p className="text-sm text-base-content/70">{friend.phone}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  className="btn btn-sm btn-circle btn-primary"
                  onClick={() => startConversationMutation.mutate(friend.id)}
                  disabled={startConversationMutation.isPending}
                >
                  {startConversationMutation.isPending ? 
                    <span className="loading loading-spinner loading-xs"></span> :
                    <FiMessageSquare className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-base-content/60">
          <p className="mb-4">You don&apos;t have any friends yet.</p>
          <button 
            className="btn btn-primary"
            onClick={() => document.getElementById('add-friend-button')?.click()}
          >
            Add Your First Friend
          </button>
        </div>
      )}
    </div>
  );
}
