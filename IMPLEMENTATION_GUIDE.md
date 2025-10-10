# Chatbot & Course Materials Implementation Guide

## Overview
This guide explains how to complete the integration of chatbots and course materials into the chat flow.

## Current Status

### ✅ Completed:
1. Database schema (chatbots & course_materials tables) - `supabase/migrations/20240307000000_create_chatbots_table.sql`
2. API routes for chatbot CRUD - `/api/chatbots` and `/api/chatbots/[id]`
3. API routes for course materials CRUD - `/api/course-materials` and `/api/course-materials/[id]`
4. AdminDashboard UI with tabs for managing chatbots and course materials
5. Hero component updated with chatbot selection props
6. InitialInputArea updated with chatbot selection dropdown

### ⚠️ Remaining Work:

#### 1. Fix app/page.tsx

The `handleSourcesAndChat` function in `app/page.tsx` needs to be updated to:

**Line ~199-345**: Replace the entire `handleSourcesAndChat` function with:

```typescript
async function handleSourcesAndChat(question: string) {
  try {
    if (!question.trim()) {
      return;
    }

    setIsLoadingSources(true);
    setLoading(true);

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('Session error:', sessionError);
      setMessages([{ role: 'assistant', content: 'Please log in to use the chat.' }]);
      router.push('/auth/login');
      return;
    }

    // Get selected chatbot configuration
    const chatbot = chatbots.find(c => c.id === selectedChatbot);
    if (!chatbot) {
      setMessages([{ role: 'assistant', content: 'Please select a valid chatbot.' }]);
      setLoading(false);
      setIsLoadingSources(false);
      return;
    }

    let parsedSourcesData: any[] = [];
    let sourcesData: any[] = [];

    // Fetch web sources if enabled
    if (chatbot.use_web_search) {
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();

      if (!refreshedSession) {
        throw new Error('Failed to refresh session');
      }

      const sourcesResponse = await fetch("/api/getSources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${refreshedSession.access_token}`
        },
        body: JSON.stringify({ question }),
        credentials: 'include'
      });

      if (sourcesResponse.ok) {
        sourcesData = await sourcesResponse.json();
        setSources(sourcesData);

        const { data: { session: newSession } } = await supabase.auth.refreshSession();
        const parsedSourcesRes = await fetch("/api/getParsedSources", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${newSession!.access_token}`
          },
          body: JSON.stringify({ sources: sourcesData }),
          credentials: 'include'
        });

        if (parsedSourcesRes.ok) {
          parsedSourcesData = await parsedSourcesRes.json();
        }
      } else {
        setSources([]);
      }
      setIsLoadingSources(false);
    }

    // Fetch course materials if enabled
    if (chatbot.use_course_materials) {
      const { data: { session: materialSession } } = await supabase.auth.refreshSession();

      if (materialSession) {
        const materialsResponse = await fetch(`/api/course-materials?chatbot_id=${selectedChatbot}`, {
          headers: {
            'Authorization': `Bearer ${materialSession.access_token}`
          }
        });

        if (materialsResponse.ok) {
          const materials = await materialsResponse.json();
          materials.forEach((material: any) => {
            parsedSourcesData.push({
              fullContent: `## ${material.title}\n\n${material.content}`
            });
          });
        }
      }
    }

    // Format sources
    const validParsedSources = Array.isArray(parsedSourcesData) ? parsedSourcesData : [];
    const formattedSources = validParsedSources.map(source => ({
      fullContent: typeof source === 'string' ? source :
                  typeof source === 'object' && source.fullContent ? source.fullContent : ''
    }));

    // Get fresh session for chat
    const { data: { session: chatSession } } = await supabase.auth.refreshSession();

    if (!chatSession) {
      throw new Error('Failed to refresh session');
    }

    // Use chatbot's custom system prompt
    const teachingMaterial = formattedSources.map(s => s.fullContent).join('\n\n');
    const systemContent = chatbot.system_prompt +
      (teachingMaterial ? `\n\nHere is the teaching material:\n${teachingMaterial}` : '');

    const initialMessage = [
      { role: "system", content: systemContent },
      { role: "user", content: question },
    ];
    setMessages(initialMessage);

    await handleChat(initialMessage, chatSession.access_token);
  } catch (error) {
    console.error('Error in handleSourcesAndChat:', error);
    setMessages([{ role: 'assistant', content: 'Sorry, there was an error processing your request. Please try again.' }]);
  } finally {
    setLoading(false);
    setIsLoadingSources(false);
  }
}
```

#### 2. Update getChat API to Use Chatbot ID

**File: `app/api/getChat/route.ts`**

The API currently only uses AI config. It should also accept and use the chatbot_id. Update the request body parsing to:

```typescript
const body = await request.json();
const { messages, chatbot_id } = body;

// If chatbot_id provided, fetch chatbot config
let chatbotConfig = null;
if (chatbot_id) {
  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('*')
    .eq('id', chatbot_id)
    .single();

  chatbotConfig = chatbot;
}
```

And update the payload to use chatbot-specific settings if available:

```typescript
const payload: TogetherAIStreamPayload = {
  model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  messages,
  stream: true,
  maxTokens: chatbotConfig?.max_tokens || aiConfig.max_tokens,
  temperature: chatbotConfig?.temperature || aiConfig.temperature,
};
```

#### 3. Update Chat Components to Pass Chatbot ID

**File: `app/page.tsx` - `handleChat` function**

Update the handleChat function call in `handleSourcesAndChat` to pass chatbot ID:

```typescript
await handleChat(initialMessage, chatSession.access_token, selectedChatbot);
```

And update the `handleChat` function signature:

```typescript
const handleChat = async (
  messages?: { role: string; content: string }[],
  accessToken?: string,
  chatbotId?: string
) => {
  // ... existing code ...

  const chatRes = await fetch("/api/getChat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ messages, chatbot_id: chatbotId }),
    // ... rest of code
  });

  // ... rest of function
}
```

## Testing Steps

1. **Run database migrations**:
   ```bash
   # Make sure your Supabase instance runs the new migration
   ```

2. **Create a test chatbot**:
   - Login as admin
   - Go to `/admin`
   - Navigate to "Chatbots" tab
   - Create a new chatbot with custom settings

3. **Add course materials**:
   - In admin dashboard, go to "Course Materials" tab
   - Select your chatbot
   - Add some course material content

4. **Test the chat flow**:
   - Logout and login as a regular user
   - Select the chatbot from dropdown
   - Enter a question
   - Verify it uses the correct system prompt and materials

5. **Test web search toggle**:
   - Create chatbots with `use_web_search` ON and OFF
   - Verify sources are only fetched when enabled

6. **Test course materials toggle**:
   - Create chatbots with `use_course_materials` ON and OFF
   - Verify materials are only used when enabled

## Additional Enhancements (Optional)

1. Add chatbot icons/avatars
2. Add markdown rendering for course materials
3. Add file upload for course materials (PDF, DOCX parsing)
4. Add chatbot categories/tags
5. Add chatbot usage analytics
6. Add per-chatbot rate limiting
7. Add chatbot sharing/copying functionality

## Notes

- The default "General Tutor" chatbot is automatically created by the migration
- Admins can activate/deactivate chatbots
- Only active chatbots appear to regular users
- Course materials support order_index for sequencing
- System prompts from chatbots override the default getSystemPrompt utility
