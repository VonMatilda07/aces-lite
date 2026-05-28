// src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client Supabase untuk query database dan real-time subscription (sinkron dengan cookie server)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Client Supabase stateless untuk kueri publik (tidak terpengaruh auth state / cookie desync)
import { createClient } from '@supabase/supabase-js'
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-public-auth-token'
  }
})