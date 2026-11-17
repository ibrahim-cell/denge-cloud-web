/*
 * Denge Cloud public client configuration.
 * Compatibility fallback: active legacy anon key from this Supabase project.
 * Low-privilege browser key protected by RLS; NOT a service_role key.
 * Never place a service_role / secret key in client files.
 */
window.DENGE_CLOUD_CONFIG = Object.freeze({
  url: 'https://cwnydectkrthlcbvhdhh.supabase.co',
  apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bnlkZWN0a3J0aGxjYnZoZGhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MDc2NDIsImV4cCI6MjExMDM4MzY0Mn0.jxihf3HhH3os6tQE8NH9BNBcaWmtUwYGh8BRZ0DhUB4',
  publishableKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bnlkZWN0a3J0aGxjYnZoZGhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MDc2NDIsImV4cCI6MjExMDM4MzY0Mn0.jxihf3HhH3os6tQE8NH9BNBcaWmtUwYGh8BRZ0DhUB4'
});
