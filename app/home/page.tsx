"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import CalendarEvents from "@/components/CalendarEvents";
import StudyPlan from "@/components/StudyPlan";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [ltiContext, setLtiContext] = useState<any>(null);
  const [showLtiWelcome, setShowLtiWelcome] = useState(false);

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
        const role = userData?.role || 'student';
        setUserRole(role);
      }

      // Check if this is an LTI launch
      const ltiLaunch = searchParams.get('lti_launch');
      if (ltiLaunch === 'true') {
        setShowLtiWelcome(true);
        // Fetch LTI context info
        loadLtiContext(session.user.id);
      }
    };

    checkAuth();
    loadChatbots();
  }, [router, searchParams]);

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

  const loadLtiContext = async (userId: string) => {
    try {
      // Get LTI user mapping and context info
      const { data: mapping } = await supabase
        .from('lti_user_mappings')
        .select(`
          *,
          platform:lti_platforms(name, platform_type),
          enrollments:lti_enrollments(
            *,
            context:lti_contexts(*)
          )
        `)
        .eq('nova_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (mapping) {
        setLtiContext({
          platform: mapping.platform,
          lmsUserData: mapping.lms_user_data,
          fullName: mapping.full_name,
          lmsRoles: mapping.lms_roles,
          enrollment: mapping.enrollments?.[0],
        });
      }
    } catch (error) {
      console.error('Error loading LTI context:', error);
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
          {/* LTI Launch Welcome Banner */}
          {showLtiWelcome && ltiContext && (
            <div className="mb-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">
                    Connected via {ltiContext.platform?.name || 'LMS'}
                  </h3>
                  <p className="mt-1 text-sm text-blue-700">
                    You&quot;re accessing NOVA from your LMS.
                    {ltiContext.enrollment?.context?.context_title && (
                      <> Course: <span className="font-medium">{ltiContext.enrollment.context.context_title}</span></>
                    )}
                  </p>
                  {ltiContext.fullName && (
                    <p className="mt-1 text-xs text-blue-600">
                      LMS User: {ltiContext.fullName}
                      {ltiContext.lmsRoles && ltiContext.lmsRoles.length > 0 && (
                        <> ({ltiContext.lmsRoles.map((r: string) => r.split('/').pop()).join(', ')})</>
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowLtiWelcome(false)}
                  className="flex-shrink-0 text-blue-400 hover:text-blue-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

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
