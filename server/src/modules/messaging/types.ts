export interface ConversationRow {
  user1_id: string;
  user2_id: string;
}

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  type?: 'text' | 'offer' | 'file' | 'system';
}

export interface NewMessageEvent {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
  sender: {
    id: string;
    full_name: string;
  };
}