import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://virfeveeuervxkuayzdq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcmZldmVldWVydnhrdWF5emRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjAzNjYsImV4cCI6MjA5MDY5NjM2Nn0.zzzDsYNQHkc-NuFBalGz_iMLD8AOpNPbg4HxXOMgz64';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Attempting connection to Supabase via API...");
    // Using PostgREST to fetch from the User table directly
    const { data, error } = await supabase.from('users').select('*').limit(1);
    
    if (error) {
        console.log("API QUERY FAILED:", error);
    } else {
        console.log("API QUERY SUCCESS! Count:", data.length);
    }
    
    // Also lets do a plain fetch and inspect headers!
    const resp = await fetch(supabaseUrl);
    console.log("\nHeaders from API root:");
    resp.headers.forEach((val, key) => {
        console.log(`  ${key}: ${val}`);
    });
}

run();
