"use client";

import { Suspense } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import InstructorDashboard from "@/components/InstructorDashboard";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

function InstructorPageContent() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        router.push('/');
        return;
      }

      if (userData?.role !== 'instructor' && userData?.role !== 'admin') {
        // Only instructors and admins can access this page
        router.push('/');
        return;
      }

      setUserRole(userData?.role);
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex grow items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex grow flex-col px-4 pb-4">
        <div className="mx-auto mt-4 w-full max-w-7xl sm:mt-6">
          <InstructorDashboard />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function InstructorPage() {
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
      <InstructorPageContent />
    </Suspense>
  );
}
