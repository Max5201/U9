// ⚡ Supabase 初始化 (全局共用) supabaseClient.js
const SUPABASE_URL = "https://owrjqbkkwdunahvzzjzc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cmpxYmtrd2R1bmFodnp6anpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDA0MTIsImV4cCI6MjA3NDMxNjQxMn0.vC4wSevXF22DBQgmAkG2gsvt4L35aqG03RCByeNzKVQ";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
