import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE || '';

if (!supabaseUrl || !supabaseServiceRole) {
  console.warn('Supabase URL or Service Role Key is missing from environment variables.');
}

// We use the service_role key to bypass RLS for administrative backend processing (like RAG embeddings)
// CAUTION: This client must only be used in server-side contexts (route handlers / Server Actions).
// DO NOT expose this client directly to the frontend.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
