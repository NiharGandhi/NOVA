"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export default function Home() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [chatbots, setChatbots] = useState<any[]>([]);

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
      }
    } catch (error) {
      console.error('Error loading chatbots:', error);
    }
  };

  const handleChatbotClick = (chatbotId: string) => {
    router.push(`/chat?chatbot=${chatbotId}`);
  };

  return (
    <>
      <Header />

      <main className="flex grow flex-col px-4 pb-4">
        <div className="mx-auto mt-10 flex max-w-7xl flex-col items-center justify-center sm:mt-36">
          <h2 className="mt-2 bg-custom-gradient bg-clip-text text-center text-4xl font-medium tracking-tight text-gray-900 sm:text-6xl">
            Your Personal University{" "}
            <span className="bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text font-bold text-transparent">
              Agent
            </span>
          </h2>
          <p className="mt-4 text-balance text-center text-sm sm:text-base">
            Select a course to start learning with your AI-powered personal tutor.
          </p>

          <div className="mt-12 grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {chatbots.map((chatbot) => (
              <div
                key={chatbot.id}
                onClick={() => handleChatbotClick(chatbot.id)}
                className="group cursor-pointer rounded-lg border-2 border-gray-200 bg-white p-6 transition-all hover:border-orange-500 hover:shadow-lg"
              >
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-orange-600">
                  {chatbot.name}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{chatbot.subject}</p>
                {chatbot.description && (
                  <p className="mt-3 text-sm text-gray-500">{chatbot.description}</p>
                )}
                <div className="mt-4 flex items-center text-sm text-orange-600 group-hover:text-orange-700">
                  <span>Start learning</span>
                  <svg
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {chatbots.length === 0 && (
            <div className="mt-12 text-center text-gray-500">
              <p>No courses available yet.</p>
              {userRole === 'admin' && (
                <p className="mt-2">
                  Go to the{" "}
                  <a href="/admin" className="text-orange-600 hover:underline">
                    Admin Dashboard
                  </a>{" "}
                  to create courses.
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
