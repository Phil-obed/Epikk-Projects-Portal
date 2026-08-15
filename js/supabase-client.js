// js/supabase-client.js
// Fill these in from Supabase dashboard -> Project Settings -> API.
// The anon key is safe to ship in frontend code — Row Level Security is what
// actually protects your data, not hiding this key. Never put the
// service_role key here.

const SUPABASE_URL = 'https://lxclnijigxyimnfjlfwx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4Y2xuaWppZ3h5aW1uZmpsZnd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMDIxMDcsImV4cCI6MjEwMTY3ODEwN30.8O76DraEU-3irpgUNbWup-Q2G9F5B0Kw5h8GOB4ZGHM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
