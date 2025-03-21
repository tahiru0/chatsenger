import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FiCheck, FiX } from 'react-icons/fi';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function FriendRequestModal({ isOpen, onClose }: Props) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const queryClient = useQueryClient();

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
      setSuccess(true);
      setPhoneNumber('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }
    
    setError(null);
    sendRequestMutation.mutate(phoneNumber.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-base-content">Add Friend</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost text-base-content"
            onClick={onClose}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        
        {success ? (
          <div className="alert alert-success">
            <FiCheck className="stroke-current shrink-0 h-6 w-6" />
            <span>Friend request sent successfully!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-base-content/80">Phone Number</span>
              </label>
              <input
                type="tel"
                placeholder="Enter phone number"
                className="input input-bordered text-base-content"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              {error && (
                <label className="label">
                  <span className="label-text-alt text-error">{error}</span>
                </label>
              )}
            </div>
            
            <div className="modal-action">
              <button 
                type="button" 
                className="btn bg-base-300 text-base-content hover:bg-base-200"
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={sendRequestMutation.isPending}
              >
                {sendRequestMutation.isPending ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  'Send Request'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
      <div className="modal-backdrop bg-base-300/50" onClick={onClose}></div>
    </div>
  );
}
