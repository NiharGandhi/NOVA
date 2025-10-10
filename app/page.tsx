"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Sources from "@/components/Sources";
import { useState, useEffect } from "react";
import {
  createParser,
  ParsedEvent,
  ReconnectInterval,
} from "eventsource-parser";
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { getSystemPrompt } from "@/utils/utils";
import Chat from "@/components/Chat";

export default function Home() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [selectedChatbot, setSelectedChatbot] = useState<string>("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        router.push('/auth/login');
        return;
      }

      // Get user role from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (userError) {
        console.error('Error fetching user role:', userError);
        setUserRole('student'); // Default to student on error
      } else {
        setUserRole(userData?.role || 'student');
      }
    };

    checkAuth();
    loadChatbots();
  }, [router]);

  const loadChatbots = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/chatbots', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChatbots(data);
        if (data.length > 0) {
          setSelectedChatbot(data[0].id); // Select first chatbot by default
        }
      }
    } catch (error) {
      console.error('Error loading chatbots:', error);
    }
  };
  const [topic, setTopic] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [sources, setSources] = useState<{ name: string; url: string }[]>([]);
  const [ragSources, setRagSources] = useState<any[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [ageGroup, setAgeGroup] = useState("Middle School");

  const handleInitialChat = async () => {
    try {
      if (!inputValue.trim()) {
        return;
      }
      console.log('Starting initial chat with:', inputValue);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session found, redirecting to login');
        router.push('/auth/login');
        return;
      }

      setShowResult(true);
      setLoading(true);
      const currentInput = inputValue; // Store the current value
      setTopic(currentInput);
      setInputValue("");

      console.log('Fetching sources and starting chat...');
      await handleSourcesAndChat(currentInput);
    } catch (error) {
      console.error('Error in handleInitialChat:', error);
      setMessages([{ role: 'assistant', content: 'Sorry, there was an error processing your request. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (messages?: { role: string; content: string }[], accessToken?: string) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth/login');
        return;
      }

      const token = accessToken || session.access_token;
      console.log('Making chat request with token...');
      
      const chatRes = await fetch("/api/getChat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ messages, chatbot_id: selectedChatbot }),
        credentials: 'include',
        cache: 'no-store'
      });

    if (!chatRes.ok) {
      if (chatRes.status === 401) {
        router.push('/auth/login');
        return;
      }
      const errorText = await chatRes.text();
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorText}` }]);
      return;
    }

    // This data is a ReadableStream
    const data = chatRes.body;
    if (!data) {
      return;
    }
    let fullAnswer = "";

    const onParse = (event: ParsedEvent | ReconnectInterval) => {
      if (event.type === "event") {
        const data = event.data;
        try {
          const parsed = JSON.parse(data);

          // Handle sources metadata
          if (parsed.type === 'sources') {
            console.log('Received sources:', parsed.sources);
            setRagSources(parsed.sources);
            return;
          }

          // Handle regular text chunks
          const text = parsed.text ?? "";
          fullAnswer += text;
          // Update messages with each chunk
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, content: lastMessage.content + text },
              ];
            } else {
              return [...prev, { role: "assistant", content: text }];
            }
          });
        } catch (e) {
          console.error(e);
        }
      }
    };

    // https://web.dev/streams/#the-getreader-and-read-methods
    const reader = data.getReader();
    const decoder = new TextDecoder();
    const parser = createParser(onParse);
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      parser.feed(chunkValue);
    }
    setLoading(false);
  } catch (error) {
    console.error(error);
    setLoading(false);
  }
  }

  async function handleSourcesAndChat(question: string) {
    try {
      if (!question.trim()) {
        return;
      }

      setIsLoadingSources(true);
      setLoading(true);

      console.log('Getting session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        setMessages([{ role: 'assistant', content: 'Please log in to use the chat.' }]);
        router.push('/auth/login');
        return;
      }

      console.log('Session found:', session.user.email);

      // Get selected chatbot configuration
      const chatbot = chatbots.find(c => c.id === selectedChatbot);
      if (!chatbot) {
        setMessages([{ role: 'assistant', content: 'Please select a valid chatbot.' }]);
        setLoading(false);
        setIsLoadingSources(false);
        return;
      }

      let parsedSources = [];
      let sources: any[] = [];

      // Fetch web sources if enabled
      if (chatbot.use_web_search) {
        console.log('Fetching sources...');
      
        // Get fresh session token
        const { data: { session: currentSession }, error: refreshError } = 
          await supabase.auth.getSession();
        
        if (refreshError || !currentSession) {
          console.error('Session refresh error:', refreshError);
          throw new Error('Session expired - please log in again');
        }

        // Get fresh access token
        const { data: { session: refreshedSession }, error: tokenError } = 
          await supabase.auth.refreshSession();
          
        if (tokenError || !refreshedSession) {
          console.error('Token refresh error:', tokenError);
          throw new Error('Failed to refresh session - please log in again');
        }

        console.log('Using access token for API request');
        const sourcesResponse = await fetch("/api/getSources", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${refreshedSession.access_token}`
          },
          body: JSON.stringify({ question }),
          credentials: 'include',
          cache: 'no-store'
        });
        
        if (!sourcesResponse.ok) {
          const errorText = await sourcesResponse.text();
          console.error('Sources API error:', sourcesResponse.status, errorText);
          throw new Error(`Sources API error: ${errorText}`);
        }

        sources = await sourcesResponse.json();
        setSources(sources);
        setIsLoadingSources(false);

        console.log('Fetching parsed sources...');
        
        // Get fresh access token for the second request
        const { data: { session: newSession }, error: newTokenError } = 
          await supabase.auth.refreshSession();
          
        if (newTokenError || !newSession) {
          console.error('Token refresh error:', newTokenError);
          throw new Error('Failed to refresh session - please log in again');
        }

    const parsedSourcesRes = await fetch("/api/getParsedSources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${newSession.access_token}`
      },
      body: JSON.stringify({ sources }),
      credentials: 'include',
      cache: 'no-store'
    });

    if (!parsedSourcesRes.ok) {
      const errorText = await parsedSourcesRes.text();
      console.error('ParsedSources API error:', parsedSourcesRes.status, errorText);
      throw new Error(`ParsedSources API error: ${errorText}`);
    }
        if (parsedSourcesRes.ok) {
          parsedSources = await parsedSourcesRes.json();
        }
      }

      // Ensure parsedSources is an array with the correct shape
      const validParsedSources = Array.isArray(parsedSources) ? parsedSources : [];
      const formattedSources = validParsedSources.map(source => ({
        fullContent: typeof source === 'string' ? source : 
                    typeof source === 'object' && source.fullContent ? source.fullContent : ''
      }));

      // Get fresh access token for the chat request
      const { data: { session: chatSession }, error: chatTokenError } = 
        await supabase.auth.refreshSession();
        
      if (chatTokenError || !chatSession) {
        console.error('Token refresh error:', chatTokenError);
        throw new Error('Failed to refresh session - please log in again');
      }

      const initialMessage = [
        { role: "system", content: getSystemPrompt(formattedSources, ageGroup) },
        { role: "user", content: `${question}` },
      ];
      setMessages(initialMessage);

      console.log('Starting chat with initial message...');
      await handleChat(initialMessage, chatSession.access_token);
    } catch (error) {
      console.error('Error in handleSourcesAndChat:', error);
      setMessages([{ role: 'assistant', content: 'Sorry, there was an error processing your request. Please try again.' }]);
    } finally {
      setLoading(false);
      setIsLoadingSources(false);
    }
  }

  return (
    <>
      <Header />

      <main
        className={`flex grow flex-col px-4 pb-4 ${showResult ? "overflow-hidden" : ""}`}
      >
        {showResult ? (
          <div className="mt-2 flex w-full grow flex-col justify-between overflow-hidden">
            <div className="flex w-full grow flex-col space-y-2 overflow-hidden">
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
          <Hero
            promptValue={inputValue}
            setPromptValue={setInputValue}
            handleChat={handleChat}
            ageGroup={ageGroup}
            setAgeGroup={setAgeGroup}
            handleInitialChat={handleInitialChat}
            selectedChatbot={selectedChatbot}
            setSelectedChatbot={setSelectedChatbot}
            chatbots={chatbots}
          />
        )}
      </main>
      <Footer />
    </>
  );
}
