// Test database connection directly
require('dotenv').config();
const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL;
console.log('Connecting to database with URL:', dbUrl);

const client = new Client({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    await client.connect();
    console.log('Successfully connected to the database!');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Current database time:', result.rows[0].current_time);
    
    await client.end();
  } catch (error) {
    console.error('Error connecting to the database:', error.message);
    if (error.message.includes('password authentication failed')) {
      console.log('\nThe database password appears to be incorrect. Please check your DATABASE_URL in .env');
    } else if (error.message.includes('no pg_hba.conf entry')) {
      console.log('\nYour IP address is not allowed to access this database.');
      console.log('Go to your Supabase dashboard > Database > Connection Pooling and enable "Allow direct connections"');
      console.log('Or add your IP address to the allowed list.');
    }
  }
}

testConnection();