import { NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'
import { validateAIRequest, defaultAIConfig } from '@/utils/aiConfig'

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json()
    
    // Get user session
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate the request against AI restrictions
    const validationResult = validateAIRequest(prompt, defaultAIConfig)
    
    if (!validationResult.isValid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Request validated successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
