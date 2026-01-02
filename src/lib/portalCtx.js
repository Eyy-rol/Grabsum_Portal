import { supabase } from "./supabaseClient";

export async function getAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error("Not logged in");
  return data.user;
}

export async function getMyProfile() {
  const user = await getAuthUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, role, is_active, is_archived, full_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Profile not found");
  return { user, profile: data };
}

export async function getActiveSy() {
  const { data, error } = await supabase
    .from("school_years")
    .select("sy_id, sy_code, status, start_date, end_date")
    .eq("status", "Active")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.sy_id) throw new Error("No Active school year found");
  return data;
}
