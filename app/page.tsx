"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import CalendarEvents from "@/components/CalendarEvents";
import StudyPlan from "@/components/StudyPlan";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

function HomeContent() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [chatbots, setChatbots] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.push('/auth/login');
        return;
      }

      // Set user email
      setUserEmail(session.user.email || '');

      // Extract name from email (before @) or use metadata
      const name = session.user.user_metadata?.full_name ||
                   session.user.user_metadata?.name ||
                   session.user.email?.split('@')[0] ||
                   'Student';
      setUserName(name);

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
        <div className="mx-auto mt-4 flex max-w-7xl flex-col sm:mt-6">
          {/* User Greeting Section */}
          <div className="mb-6 flex items-center justify-between rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 p-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                Welcome back, {userName}! 👋
              </h1>
              <p className="mt-1 text-xs text-gray-600 sm:text-sm">
                {userEmail}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-600">Role:</span>
                <span className="font-semibold text-orange-600 capitalize">
                  {userRole || 'Student'}
                </span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-600">Courses:</span>
                <span className="font-semibold text-orange-600">
                  {chatbots.length}
                </span>
              </div>
            </div>
          </div>

          {/* Calendar Events and Study Plan Section */}
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <CalendarEvents />
            <StudyPlan />
          </div>

          {/* Courses Section */}
          <div>
            <h2 className="mb-6 text-2xl font-bold text-gray-900 sm:text-3xl">
              Your Courses
            </h2>
            <p className="mb-8 text-sm text-gray-600 sm:text-base">
              Select a course to start learning with your AI-powered personal tutor.
            </p>

          <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
      </main>

      <Footer />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <>
        <Header />
        <main className="flex grow items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </main>
        <Footer />
      </>
    }>
      <HomeContent />
    </Suspense>
  );
}
