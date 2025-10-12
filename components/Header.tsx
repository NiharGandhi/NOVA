'use client'

import { Logo } from "./logo";
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const Header = () => {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('No session found');
          setUserRole(null);
          return;
        }

        // First, check if user exists in users table
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking user:', checkError);
        }

        // Debug logging
        console.log('Session user:', session.user);
        console.log('Existing user data:', existingUser);

        // If user doesn't exist, create them
        if (!existingUser) {
          console.log('Creating new user record');
          const { error: insertError } = await supabase
            .from('users')
            .insert([
              {
                id: session.user.id,
                email: session.user.email,
                role: 'student'
              }
            ]);

          if (insertError) {
            console.error('Error creating user:', insertError);
          }
          setUserRole('student');
        } else {
          console.log('User role:', existingUser.role);
          setUserRole(existingUser.role);
        }
      } catch (error) {
        console.error('Error in getUser:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="container flex h-[60px] shrink-0 items-center justify-between px-4 lg:h-[80px] lg:px-0">
      <Link href="/" className="hover:opacity-80">
        <Logo className="w-30 sm:w-36" />
      </Link>
      <div className="flex items-center gap-4">
        {!loading && userRole === 'admin' && (
          <Link
            href="/admin"
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            Admin Dashboard
          </Link>
        )}
        {!loading && userRole === 'instructor' && (
          <Link
            href="/instructor"
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            Instructor Dashboard
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Header;