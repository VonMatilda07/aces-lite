import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ivzmckcsqzgpotvynavp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2em1ja2NzcXpncG90dnluYXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTIyODksImV4cCI6MjA5NDc2ODI4OX0.piWQ7IMGoUX8SNZTVJB_fPY5p_8ontaythENtdWqlbA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
  
  console.log('Result:', { data, error })
}

test()
