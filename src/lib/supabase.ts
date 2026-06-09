import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://xlwcozznliafhouhqjzl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsd2NvenpubGlhZmhvdWhxanpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTkwMzAsImV4cCI6MjA5NjUzNTAzMH0.i-GTNnGK_5GMUum_tmUKIiX4NUkmEiJovK_M7BwGFfg'
)
