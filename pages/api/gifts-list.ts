
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req,res){
  const { data, error } = await supabase.from("gift_listings").select("*").eq("status","active");
  if(error) return res.status(400).json({error:error.message});
  res.json(data||[]);
}
