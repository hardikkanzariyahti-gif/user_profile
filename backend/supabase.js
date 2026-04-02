const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://virfeveeuervxkuayzdq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcmZldmVldWVydnhrdWF5emRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjAzNjYsImV4cCI6MjA5MDY5NjM2Nn0.zzzDsYNQHkc-NuFBalGz_iMLD8AOpNPbg4HxXOMgz64'
);

module.exports = supabase;