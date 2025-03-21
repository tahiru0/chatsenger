import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  }
);

export const CHANNELS = {
  CONVERSATION: 'conversation',
  FRIENDS: 'friends',
};

export const EVENTS = {
  NEW_MESSAGE: 'new-message',
  MESSAGE_SEEN: 'message-seen',
  NEW_FRIEND_REQUEST: 'new-friend-request',
  FRIEND_REQUEST_ACCEPTED: 'friend-request-accepted',
};
