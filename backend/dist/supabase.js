"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = 'https://virfeveeuervxkuayzdq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcmZldmVldWVydnhrdWF5emRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjAzNjYsImV4cCI6MjA5MDY5NjM2Nn0.zzzDsYNQHkc-NuFBalGz_iMLD8AOpNPbg4HxXOMgz64';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
exports.default = supabase;
//# sourceMappingURL=supabase.js.map