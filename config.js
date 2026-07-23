// BuildMyBill — Supabase project connection.
// The anon key is PUBLIC by design: it only permits what the database's
// Row Level Security policies allow (a user's own company data, after login).
// Security lives in the DB policies, not in hiding this value. Safe in a public repo.
window.BMB_CONFIG = {
  url: "https://kjyduwbvgaauxsljmrcy.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqeWR1d2J2Z2FhdXhzbGptcmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjQ1ODUsImV4cCI6MjEwMDQwMDU4NX0.52rOaItJ0mMq_VW1ODhjICXKpihbim_b824clUgVaaQ",
};
