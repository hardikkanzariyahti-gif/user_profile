import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://virfeveeuervxkuayzdq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcmZldmVldWVydnhrdWF5emRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjAzNjYsImV4cCI6MjA5MDY5NjM2Nn0.zzzDsYNQHkc-NuFBalGz_iMLD8AOpNPbg4HxXOMgz64';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
