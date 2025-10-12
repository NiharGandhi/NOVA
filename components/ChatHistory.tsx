'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

interface ChatSession {
  id: string;
  title: string;
  chatbot_id: string;
  created_at: string;
  updated_at: string;
}

interface ChatHistoryProps {
  chatbotId: string;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export default function ChatHistory({
  chatbotId,
  currentSessionId,
  onSelectSession,
  onNewChat
}: ChatHistoryProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [chatbotId]);

  // Refresh sessions when currentSessionId changes (new session created)
  useEffect(() => {
    if (currentSessionId) {
      loadSessions();
    }
  }, [currentSessionId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `/api/chat-history/sessions?chatbot_id=${chatbotId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Delete this chat?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/chat-history/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        setSessions(sessions.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          onNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex h-full flex-col border-r bg-gray-50">
      <div className="border-b bg-white p-4">
        <button
          onClick={onNewChat}
          className="w-full rounded-lg bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-2 text-sm font-medium text-white hover:from-orange-700 hover:to-orange-600"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-200"></div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No chat history yet
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group flex items-center justify-between rounded-lg p-3 cursor-pointer transition ${
                  currentSessionId === session.id
                    ? 'bg-orange-100 border border-orange-300'
                    : 'bg-white hover:bg-gray-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {session.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(session.updated_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  className="ml-2 opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-red-100 transition"
                >
                  <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
