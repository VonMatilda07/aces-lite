const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Extract env variables manually from .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Connecting to Supabase...');
  const { data, error } = await supabase.from('menus').select('*').limit(1);
  if (error) {
    console.error('Error fetching from menus:', error);
  } else {
    console.log('Columns in menus table:', data.length > 0 ? Object.keys(data[0]) : 'No rows found');
    console.log('Sample data:', data[0]);
  }
}

run();
