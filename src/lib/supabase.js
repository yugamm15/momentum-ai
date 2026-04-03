import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://irrczdmajazxwnjmrgtk.supabase.co';
const supabaseKey = 'sb_publishable_xkmC5OFqgHdFL8zwzqUE5g__q5yycaq';

export const supabase = createClient(supabaseUrl, supabaseKey);
