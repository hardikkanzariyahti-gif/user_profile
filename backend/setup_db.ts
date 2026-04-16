import supabase from './supabase';

async function setup(): Promise<void> {
  console.log('--- Checking Database Schema ---');
  
  try {
    // Check if password column exists by trying to select it
    const { error } = await supabase
      .from('users')
      .select('password')
      .limit(1);

    if (error && error.message.includes('column "password" does not exist')) {
      console.log('⚠️  Password column is missing.');
      console.log('\nIMPORTANT: Please run the following SQL command in your Supabase Dashboard SQL Editor:\n');
      console.log('\x1b[36m%s\x1b[0m', 'ALTER TABLE users ADD COLUMN password TEXT;');
      console.log('\nAfter running this, your login system will be ready! 🚀');
    } else if (error) {
      console.error('Error checking schema:', error.message);
    } else {
      console.log('✅ Database schema is already up to date!');
    }
  } catch (err: any) {
    console.error('Migration check failed:', err.message);
  }
}

setup();
