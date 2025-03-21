import { useState, useRef } from 'react';
import { BsEmojiSmile, BsImages } from 'react-icons/bs';
import { GiphyPicker } from './GiphyPicker';
import { GiphyGif } from '@/types/giphy';

type MessageInputProps = {
  onSendMessage: (text: string) => void;
  onSendGif: (gif: GiphyGif) => void;
  isSending: boolean;
};

export const MessageInput = ({ onSendMessage, onSendGif, isSending }: MessageInputProps) => {
  const [messageInput, setMessageInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const giphyPickerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() && !isSending) {
      onSendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  const handleGifSelect = (gif: GiphyGif) => {
    if (!isSending) {
      onSendGif(gif);
      setShowGiphyPicker(false);
    }
  };

  return (
    <div className="p-4 border-t border-base-300 bg-base-200">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="relative">
          {showGiphyPicker && (
            <GiphyPicker 
              onGifSelect={handleGifSelect} 
              giphyPickerRef={giphyPickerRef}
            />
          )}
          
          <div className="flex gap-2 items-center">
            <div className="flex-1 flex">
              <input
                type="text"
                placeholder="Type a message..."
                className="input input-bordered flex-1 pr-24"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <div className="absolute right-24 top-1/2 -translate-y-1/2 flex items-center gap-2 mr-2">
                <button
                  id="giphy-button"
                  type="button"
                  className="btn btn-sm btn-ghost btn-circle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEmojiPicker(false);
                    setShowGiphyPicker(!showGiphyPicker);
                  }}
                >
                  <BsImages className="w-5 h-5" />
                </button>
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={!messageInput.trim() || isSending}
              >
                {isSending ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
