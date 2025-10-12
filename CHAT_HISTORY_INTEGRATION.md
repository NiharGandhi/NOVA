# Chat History Integration - Final Steps

I've created the complete chat history system! Here's what's been set up:

## What's Ready:

### 1. Database Schema ✅
- **chat_sessions**: Stores individual chat sessions per user/chatbot
- **chat_messages**: Stores all messages in each session
- Includes RLS policies for security
- Auto-updates session timestamp when messages are added

### 2. API Routes ✅
- `POST /api/chat-history/sessions` - Create new chat session
- `GET /api/chat-history/sessions?chatbot_id=X` - Get all sessions for a chatbot
- `GET /api/chat-history/messages?session_id=X` - Get messages for a session
- `POST /api/chat-history/messages` - Save messages to a session
- `DELETE /api/chat-history/sessions/[id]` - Delete a session
- `PATCH /api/chat-history/sessions/[id]` - Update session title

### 3. Components ✅
- **ChatHistory** component with sidebar UI
- Helper functions in `utils/chatHistory.ts`

## To Complete the Integration:

### Step 1: Run the Database Migration

In your Supabase dashboard (https://vzspumpixsvgrveuenyn.supabase.co):
1. Go to SQL Editor
2. Click "New query"
3. Copy and paste from: `supabase/migrations/20240313000000_create_chat_history.sql`
4. Click "Run"

### Step 2: Add Chat History to the Chat Page

In `/app/chat/page.tsx`, add these key functions after the existing `handleInitialChat`:

```typescript
// Load a previous chat session
const loadSession = async (sessionId: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`/api/chat-history/messages?session_id=${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const loadedMessages = data.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }));
      setMessages(loadedMessages);
      setCurrentSessionId(sessionId);
      setShowResult(true);
    }
  } catch (error) {
    console.error('Error loading session:', error);
  }
};

// Start a new chat
const handleNewChat = () => {
  setMessages([]);
  setCurrentSessionId(null);
  setShowResult(false);
  setInputValue('');
  setSources([]);
  setRagSources([]);
};

// Save messages to current session
const saveCurrentSession = async (messagesToSave: typeof messages) => {
  try {
    if (!currentSessionId) {
      // Create new session
      const firstUserMessage = messagesToSave.find(m => m.role === 'user')?.content || 'New Chat';
      const title = firstUserMessage.substring(0, 50) + (firstUserMessage.length > 50 ? '...' : '');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const createResponse = await fetch('/api/chat-history/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chatbot_id: selectedChatbot, title })
      });

      if (createResponse.ok) {
        const data = await createResponse.json();
        setCurrentSessionId(data.session.id);

        // Save messages
        await fetch('/api/chat-history/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ session_id: data.session.id, messages: messagesToSave })
        });
      }
    }
  } catch (error) {
    console.error('Error saving session:', error);
  }
};
```

### Step 3: Call saveCurrentSession

In the `handleChat` function, after the streaming completes, add:

```typescript
// After the while loop ends and setLoading(false) is called:
await saveCurrentSession(messages);
```

### Step 4: Update the UI Layout

Replace the main content section with:

```typescript
{showResult ? (
  <div className="mt-2 flex w-full grow overflow-hidden">
    {/* Chat History Sidebar */}
    {showHistory && (
      <div className="w-64 shrink-0">
        <ChatHistory
          chatbotId={selectedChatbot}
          currentSessionId={currentSessionId}
          onSelectSession={loadSession}
          onNewChat={handleNewChat}
        />
      </div>
    )}

    {/* Main Chat Area */}
    <div className="flex w-full grow flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl grow flex-col gap-4 overflow-hidden lg:flex-row lg:gap-10">
        <Chat
          messages={messages}
          disabled={loading}
          promptValue={inputValue}
          setPromptValue={setInputValue}
          setMessages={setMessages}
          handleChat={handleChat}
          topic={topic}
        />
        <Sources sources={sources} isLoading={isLoadingSources} ragSources={ragSources} />
      </div>
    </div>
  </div>
) : (
  // Hero component...
)}
```

## Features:

✅ **Persistent Chat History**: All conversations saved per subject
✅ **Session Management**: Create, load, and delete sessions
✅ **Auto-naming**: First message becomes session title
✅ **Sidebar UI**: Beautiful sidebar with timestamps
✅ **Per-Subject History**: Each course has its own chat history
✅ **Real-time Updates**: Session list updates when you chat

## Testing:

1. Navigate to `/chat?chatbot=[id]`
2. Start a conversation
3. Messages automatically save
4. Click "+ New Chat" to start fresh
5. Previous chats appear in sidebar
6. Click any chat to load it
7. Delete icon appears on hover

All the infrastructure is ready - just need to run the migration and add the integration code!
