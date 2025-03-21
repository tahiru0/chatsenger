import { useState, useRef } from 'react';
import { Grid } from '@giphy/react-components';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { GiphyGif } from '@/types/giphy';

// Initialize Giphy API
const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY || 'FHGPxAJIdGlLKBnhtKfuiaU8U3vXKJCF');

type GiphyPickerProps = {
  onGifSelect: (gif: GiphyGif) => void;
  giphyPickerRef: React.RefObject<HTMLDivElement>;
};

export const GiphyPicker = ({ onGifSelect, giphyPickerRef }: GiphyPickerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  return (
    <div 
      ref={giphyPickerRef}
      className="absolute bottom-14 right-0 z-10 bg-base-200 p-2 rounded-lg shadow-lg border border-base-300"
      style={{ width: '340px', height: '450px', overflowY: 'auto' }}
    >
      <div className="mb-2">
        <input
          type="text"
          placeholder="Search GIFs..."
          className="input input-sm input-bordered w-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div style={{ height: '400px', overflow: 'auto' }}>
        <Grid
          key={searchQuery}
          width={320}
          columns={2}
          fetchGifs={(offset: number) => 
            searchQuery
              ? gf.search(searchQuery, { offset, limit: 10 })
              : gf.trending({ offset, limit: 10 })
          }
          onGifClick={(gif, e) => {
            e.preventDefault();
            onGifSelect(gif);
          }}
        />
      </div>
    </div>
  );
};
