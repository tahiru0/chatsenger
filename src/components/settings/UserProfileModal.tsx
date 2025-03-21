import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FiX, FiSave } from 'react-icons/fi';
import { useToast } from '@/providers/ToastProvider';

type UserProfileProps = {
  isOpen: boolean;
  onClose: () => void;
  userData: {
    id: number;
    name: string;
    phone: string;
  } | null;
};

export default function UserProfileModal({ isOpen, onClose, userData }: UserProfileProps) {
  const [name, setName] = useState(userData?.name || '');
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedName: string) => {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: updatedName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      return res.json();
    },
    onSuccess: () => {
      addToast('Profile updated successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['user'] });
      onClose();
      // Refresh the page to update the UI
      setTimeout(() => window.location.reload(), 500);
    },
    onError: (error: Error) => {
      addToast(error.message, 'error');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      updateProfileMutation.mutate(name);
    } else {
      addToast('Name cannot be empty', 'error');
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-base-content">Your Profile</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost text-base-content"
            onClick={onClose}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div className="avatar placeholder mb-4">
            <div className="bg-primary text-primary-content rounded-full w-24 h-24">
              <span className="text-3xl">{userData?.name?.charAt(0) || '?'}</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-base-content">{userData?.name}</h2>
          <p className="text-base-content/70">{userData?.phone}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-control">
            <label className="label">
              <span className="label-text text-base-content/80">Display Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full text-base-content"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
            />
          </div>

          <div className="form-control mt-4">
            <label className="label">
              <span className="label-text text-base-content/80">Phone Number</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full text-base-content/70"
              value={userData?.phone || ''}
              disabled
              readOnly
            />
            <label className="label">
              <span className="label-text-alt text-base-content/50">Phone number cannot be changed</span>
            </label>
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
              disabled={updateProfileMutation.isPending || name === userData?.name}
            >
              {updateProfileMutation.isPending ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <>
                  <FiSave className="mr-2" /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop bg-base-300/50" onClick={onClose}></div>
    </div>
  );
}
