import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check URL for OAuth errors
    const url = new URL(window.location.href)
    const error = url.searchParams.get('error')
    const errorDesc = url.searchParams.get('error_description')
    if (error) {
      console.error('🔴 OAuth Error:', error)
      console.error('🔴 OAuth Error Description:', decodeURIComponent(errorDesc || ''))
      console.log('💡 Check: 1) Google Cloud Console redirect URI matches Supabase callback URL')
      console.log('💡 Check: 2) Client ID/Secret in Supabase matches Google Cloud Console')
      console.log('💡 Check: 3) OAuth consent screen is configured in Google Cloud')
    }

    console.log('🔍 [Auth] Checking session...')
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('🔴 [Auth] getSession error:', error)
      }
      console.log('🔍 [Auth] Session:', session ? `User ${session.user.email}` : 'No session')
      console.log('🔍 [Auth] Access token exists:', !!session?.access_token)
      console.log('🔍 [Auth] Provider token exists:', !!session?.provider_token)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔍 [Auth] State changed:', event, session?.user?.email || 'no user')
      setSession(session)
      setUser(session?.user ?? null)

      // Save Google tokens after OAuth sign in (fire and forget)
      if (event === 'SIGNED_IN' && session?.provider_token) {
        console.log('🔍 [Auth] Saving Google tokens...')
        void supabase.from('user_tokens').upsert({
          user_id: session.user.id,
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
          .then(({ error }) => {
            if (error) {
              console.error('🔴 [Auth] Failed to save tokens:', error.message)
            } else {
              console.log('✅ [Auth] Google tokens saved')
            }
          })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    const redirectUrl = window.location.origin
    console.log('🔍 [Auth] Redirect URL:', redirectUrl)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'  // Forces refresh token grant
        }
      },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, session, loading, signInWithGoogle, signOut }
}
