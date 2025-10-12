'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  isDeadline?: boolean;
  isHomework?: boolean;
  isAssignment?: boolean;
}

export default function CalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    checkConnection();

    // Re-check connection if returning from OAuth
    if (searchParams.get('calendar') === 'connected') {
      setTimeout(() => {
        checkConnection();
      }, 500);
    }
  }, [searchParams]);

  const checkConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userData } = await supabase
        .from('users')
        .select('calendar_connected')
        .eq('id', session.user.id)
        .single();

      if (userData?.calendar_connected) {
        setIsConnected(true);
        fetchEvents();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/calendar/events', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectCalendar = async () => {
    try {
      setConnecting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/calendar/connect', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting calendar:', error);
      setConnecting(false);
    }
  };

  const disconnectCalendar = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setIsConnected(false);
        setEvents([]);
      }
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);

    const diffTime = eventDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Past due';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';

    // For all other dates, show the actual date with day of week
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: eventDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getWeeklySummary = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);

    const thisWeek = events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= now && eventDate < weekEnd;
    });

    return {
      total: thisWeek.length,
      today: thisWeek.filter(e => {
        const eventDate = new Date(e.start);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === now.getTime();
      }).length,
      tomorrow: thisWeek.filter(e => {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const eventDate = new Date(e.start);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === tomorrow.getTime();
      }).length,
      thisWeek: thisWeek.length,
    };
  };

  const getEventIcon = (event: CalendarEvent) => {
    if (event.isDeadline) return '🔴';
    if (event.isHomework) return '📝';
    if (event.isAssignment) return '📚';
    return '📅';
  };

  if (!isConnected) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Connect Google Calendar
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            Stay on top of your deadlines, assignments, and homework by connecting your Google Calendar.
          </p>
          <button
            onClick={connectCalendar}
            disabled={connecting}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : 'Connect Calendar'}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="animate-pulse">
          <div className="mb-4 h-6 w-48 rounded bg-gray-200"></div>
          <div className="space-y-3">
            <div className="h-16 rounded bg-gray-100"></div>
            <div className="h-16 rounded bg-gray-100"></div>
            <div className="h-16 rounded bg-gray-100"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Upcoming Deadlines & Homework
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              fetchEvents();
            }}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="Refresh events"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={disconnectCalendar}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Disconnect
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          <p className="text-sm">No upcoming deadlines or assignments found.</p>
          <p className="mt-1 text-xs">Events with keywords like &quot;deadline&quot;, &quot;homework&quot;, or &quot;assignment&quot; will appear here.</p>
        </div>
      ) : (
        <>
          {/* Weekly Summary */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-orange-50 p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{getWeeklySummary().today}</p>
              <p className="text-xs text-gray-600">Today</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{getWeeklySummary().tomorrow}</p>
              <p className="text-xs text-gray-600">Tomorrow</p>
            </div>
            <div className="rounded-lg bg-purple-50 p-3 text-center">
              <p className="text-2xl font-bold text-purple-600">{getWeeklySummary().thisWeek}</p>
              <p className="text-xs text-gray-600">This Week</p>
            </div>
          </div>

          {/* Events List */}
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-orange-300 hover:bg-orange-50"
              >
                <span className="text-2xl">{getEventIcon(event)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{event.summary}</p>
                  {event.description && (
                    <p className="mt-1 text-xs text-gray-600 line-clamp-2">{event.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-orange-600 font-medium">
                      {formatDate(event.start)}
                    </span>
                    {event.start.includes('T') && (
                      <span className="text-gray-500">
                        at {formatTime(event.start)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
