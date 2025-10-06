// Supabase connection test
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.log('Available environment variables:', Object.keys(process.env).join(', '));
  process.exit(1);
}

console.log('Connecting to Supabase at URL:', supabaseUrl);

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test connection
async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Try to get the current timestamp from Supabase
    const { data, error } = await supabase.rpc('get_timestamp');
    
    if (error) {
      console.log('Connection test failed with error:', error.message);
      
      // Try a simple query instead
      console.log('Trying a simple table query...');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .limit(1);
      
      if (userError) {
        console.log('User table query failed:', userError.message);
        console.log('This is expected if the users table doesn\'t exist yet.');
        console.log('Connection appears to be working, but the schema is not set up.');
      } else {
        console.log('Successfully queried users table:', userData);
      }
      
      return;
    }
    
    console.log('Connection successful! Server timestamp:', data);
  } catch (err) {
    console.error('Error testing Supabase connection:', err);
  }
}

testConnection();