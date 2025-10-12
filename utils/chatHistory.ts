import { supabase } from './supabase';

export async function createChatSession(chatbotId: string, title: string = 'New Chat') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch('/api/chat-history/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ chatbot_id: chatbotId, title })
  });

  if (!response.ok) throw new Error('Failed to create session');
  const data = await response.json();
  return data.session;
}

export async function saveMessages(sessionId: string, messages: Array<{ role: string; content: string }>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch('/api/chat-history/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ session_id: sessionId, messages })
  });

  if (!response.ok) throw new Error('Failed to save messages');
}

export async function loadMessages(sessionId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`/api/chat-history/messages?session_id=${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });

  if (!response.ok) throw new Error('Failed to load messages');
  const data = await response.json();
  return data.messages;
}

export function generateChatTitle(firstMessage: string): string {
  // Take first 50 chars of the first user message as title
  const title = firstMessage.trim().substring(0, 50);
  return title.length < firstMessage.trim().length ? `${title}...` : title;
}
