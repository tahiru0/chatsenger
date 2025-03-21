import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

// Create Pusher server instance
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// Create Pusher client with better configuration
export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    enabledTransports: ["ws", "wss"],
    forceTLS: true,
    activityTimeout: 30000,
    pongTimeout: 15000
  }
);

// Add better connection handling
pusherClient.connection.bind('error', (err: Error) => {
  console.error('Pusher connection error:', err);
});

pusherClient.connection.bind('connected', () => {
  console.log('Connected to Pusher');
});

// Existing constants
export const CHANNELS = {
  CONVERSATION: 'conversation',
  FRIENDS: 'friends',
};

export const EVENTS = {
  NEW_MESSAGE: 'new-message',
  MESSAGE_SEEN: 'message-seen',
  NEW_FRIEND_REQUEST: 'new-friend-request',
  FRIEND_REQUEST_ACCEPTED: 'friend-request-accepted',
  CONVERSATION_UPDATED: 'conversation-updated',
};
