'use client'

import { Logo } from "./logo";
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';

const Header = () => {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        setUserRole(user?.role || 'student');
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <div className="container flex h-[60px] shrink-0 items-center justify-between px-4 lg:h-[80px] lg:px-0">
      <a href="/">
        <Logo className="w-30 sm:w-36" />
      </a>
      <div className="flex items-center gap-4">
        {userRole === 'admin' && (
          <a
            href="/admin"
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            Admin Dashboard
          </a>
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