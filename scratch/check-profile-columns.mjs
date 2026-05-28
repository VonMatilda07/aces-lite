import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ivzmckcsqzgpotvynavp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2em1ja2NzcXpncG90dnluYXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTIyODksImV4cCI6MjA5NDc2ODI4OX0.piWQ7IMGoUX8SNZTVJB_fPY5p_8ontaythENtdWqlbA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const email = `check-schema-${Date.now()}@example.com`
  const password = 'Password123!'
  
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  })
  
  if (signUpError) {
    console.error('SignUp Error:', signUpError.message)
    return
  }
  
  // Wait a moment for trigger
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', signUpData.user.id)
    .single()
    
  console.log('Profile columns:', profileData ? Object.keys(profileData) : 'null')
  console.log('Profile data:', profileData)
  
  // Clean up
  await supabase.auth.signOut()
}

run()
