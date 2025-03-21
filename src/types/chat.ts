export type Message = {
  id: number | string;
  content: string;
  senderId: number;
  createdAt: string;
  status: 'sent' | 'delivered' | 'seen';
  sender: {
    id: number;
    name: string;
  };
  gifUrl?: string;
};

export type Conversation = {
  id: number;
  name: string | null;
  participants: {
    id: number;
    name: string;
  }[];
};

export type MessagesData = {
  messages: Message[];
  pagination: {
    hasMore: boolean;
    totalCount: number;
    nextCursor: number | null;
  }
};
