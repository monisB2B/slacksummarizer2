import { createClient } from '@supabase/supabase-js'
import config from './config'

// Initialize Supabase client with your Supabase URL and anon key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || config.SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY
)

export { supabase }