"use client";

import Footer from "@/components/Footer";
import { Logo } from "@/components/logo";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function LandingPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // User is authenticated, redirect to /home
        router.push('/home');
      } else {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <header className="container flex h-[60px] shrink-0 items-center justify-between px-4 lg:h-[80px] lg:px-0">
        <Logo className="w-30 sm:w-36" />
        <div className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-gray-700 hover:text-orange-600"
          >
            Login
          </Link>
          <Link
            href="/auth/login"
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex grow flex-col px-4 pb-4">
        <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center text-center sm:mt-12">
          {/* Hero Section */}
          <div className="mb-12">
            <h1 className="mb-4 text-4xl font-bold text-gray-900 sm:text-5xl lg:text-6xl">
              Your AI Personal Tutor
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600 sm:text-xl">
              Learn faster and smarter with NOVA, your AI-powered personal tutoring assistant.
              Get personalized lessons, interactive learning, and instant help anytime.
            </p>
            <Link
              href="/auth/login"
              className="inline-block rounded-lg bg-orange-600 px-8 py-3 text-lg font-medium text-white hover:bg-orange-700"
            >
              Start Learning Now
            </Link>
          </div>

          {/* Features Section */}
          <div className="mb-12 grid w-full gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border-2 border-gray-200 bg-white p-6 text-left">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Personalized Learning
              </h3>
              <p className="text-gray-600">
                AI-powered lessons tailored to your age, learning style, and pace.
              </p>
            </div>

            <div className="rounded-lg border-2 border-gray-200 bg-white p-6 text-left">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Interactive Tutoring
              </h3>
              <p className="text-gray-600">
                Engage in conversations with your AI tutor that adapts to your questions.
              </p>
            </div>

            <div className="rounded-lg border-2 border-gray-200 bg-white p-6 text-left">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Real-time Feedback
              </h3>
              <p className="text-gray-600">
                Get instant answers and explanations powered by advanced AI.
              </p>
            </div>

            <div className="rounded-lg border-2 border-gray-200 bg-white p-6 text-left">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                24/7 Availability
              </h3>
              <p className="text-gray-600">
                Learn anytime, anywhere with your AI tutor always ready to help.
              </p>
            </div>

            <div className="rounded-lg border-2 border-gray-200 bg-white p-6 text-left">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Track Progress
              </h3>
              <p className="text-gray-600">
                Monitor your learning journey with detailed progress tracking.
              </p>
            </div>

            <div className="rounded-lg border-2 border-gray-200 bg-white p-6 text-left">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Web-Powered Learning
              </h3>
              <p className="text-gray-600">
                Access up-to-date information from across the web to enhance your learning.
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div className="w-full rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 p-8 text-center">
            <h2 className="mb-4 text-2xl font-bold text-gray-900 sm:text-3xl">
              Ready to transform your learning?
            </h2>
            <p className="mx-auto mb-6 max-w-2xl text-gray-600">
              Join thousands of students already using NOVA to achieve their learning goals.
            </p>
            <Link
              href="/auth/login"
              className="inline-block rounded-lg bg-orange-600 px-8 py-3 text-lg font-medium text-white hover:bg-orange-700"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
