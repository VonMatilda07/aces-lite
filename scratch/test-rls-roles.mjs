import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ivzmckcsqzgpotvynavp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2em1ja2NzcXpncG90dnluYXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTIyODksImV4cCI6MjA5NDc2ODI4OX0.piWQ7IMGoUX8SNZTVJB_fPY5p_8ontaythENtdWqlbA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log('--- TESTING ANONYMOUS SELECT ---')
    const { data: anonData, error: anonError } = await supabase.from('menus').select('*')
    if (anonError) {
        console.error('Anon Select Error:', anonError)
    } else {
        console.log('Anon Select Success. Count:', anonData.length)
    }

    console.log('\n--- TESTING AUTHENTICATED SELECT ---')
    // Let's create a temporary user
    const email = `test-rls-${Date.now()}@example.com`
    const password = 'Password123!'

    console.log(`Signing up temporary user: ${email}`)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password
    })

    if (signUpError) {
        console.error('SignUp Error:', signUpError.message)
        return
    }

    const session = signUpData.session
    if (!session) {
        console.log('SignUp succeeded but no session returned (needs email verification?). Trying to sign in anyway...')
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        if (signInError) {
            console.error('SignIn Error:', signInError.message)
            return
        }
        console.log('Logged in successfully!')
    } else {
        console.log('Logged in successfully via SignUp!')
    }

    // Now query as authenticated
    const { data: authData, error: authError } = await supabase.from('menus').select('*')
    if (authError) {
        console.error('Authenticated Select Error:', authError)
    } else {
        console.log('Authenticated Select Success. Count:', authData.length)
        if (authData.length === 0) {
            console.log('WARNING: Authenticated user received 0 items! This confirms the RLS issue.')
        } else {
            console.log('Authenticated user received items successfully.')
        }
    }

    // Clean up if possible
    console.log('\nCleaning up: Logging out...')
    await supabase.auth.signOut()
}

run()
