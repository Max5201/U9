// ⚡ Supabase 初始化 (全局共用) supabaseClient.js
const SUPABASE_URL = "https://zihkejbhbtpijfpvwmyu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaGtlamJoYnRwaWpmcHZ3bXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTEwMTMsImV4cCI6MjA3NDQyNzAxM30.Th8iXKRcgif-wdsLCqYS1P2Q5xrgj2VHp94tQ_eylJQ";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
