import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://virfeveeuervxkuayzdq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcmZldmVldWVydnhrdWF5emRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjAzNjYsImV4cCI6MjA5MDY5NjM2Nn0.zzzDsYNQHkc-NuFBalGz_iMLD8AOpNPbg4HxXOMgz64';

async function wakeUp() {
  console.log("Attemping to trigger database via REST interface...");
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error) {
       console.error("REST API Error:", error.message);
    } else {
       console.log("SUCCESS! Data fetched:", data);
    }
  } catch (e) {
    console.error("Exception during wakeup:", e);
  }
}

wakeUp();
