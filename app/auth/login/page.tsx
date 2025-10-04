'use client'

import Auth from '@/components/Auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { supabase } from '@/utils/supabase'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/')
      }
    }
    checkUser()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50">
      <Auth />
    </div>
  )
}
