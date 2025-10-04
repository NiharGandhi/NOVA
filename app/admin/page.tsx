'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'
import AdminDashboard from '@/components/AdminDashboard'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        setLoading(true)
        // Get session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          throw new Error('Authentication error')
        }

        if (!session) {
          console.log('No session found')
          router.push('/auth/login')
          return
        }

        // Check user role
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()

        if (userError) {
          console.error('Error fetching user role:', userError)
          throw new Error('Error fetching user role')
        }

        if (!userData || userData.role !== 'admin') {
          console.log('User is not admin:', userData?.role)
          router.push('/')
          return
        }

        setLoading(false)
      } catch (error) {
        console.error('Error in checkAdminAccess:', error)
        setError(error instanceof Error ? error.message : 'An error occurred')
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  return <AdminDashboard />
}