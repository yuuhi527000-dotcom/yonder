const SUPABASE_URL = 'https://muazseqaumtzzpsvogue.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11YXpzZXFhdW10enpwc3ZvZ3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODAyNzAsImV4cCI6MjA5NTQ1NjI3MH0.5Gth7JImYUJwQZFvbAjgv6xu6FiYtUiyboUkMnTaoPE';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
