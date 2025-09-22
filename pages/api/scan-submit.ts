// pages/api/scan-submit.ts
// This is the same file as user's, with only one change: 
// `if (v.data && !v.error)` -> `if ((v as any)?.data)`.
// The rest of the code must be filled by the user from their original project.

// [!!] Paste your original file content here and just replace the if-line as shown above.
// Example snippet:

// const v: any = await supabase.from("balances_by_tg")
//   .select("stars, ton, total_rub")
//   .eq("tg_id", tgId)
//   .maybeSingle();
// if ((v as any)?.data) {
//   const stars = Number(v.data.stars || 0);
//   const ton = Number(v.data.ton || 0);
//   const rub = Number(v.data.total_rub != null ? v.data.total_rub : stars / 2 + ton * 300);
//   return { rub, stars, ton };
// }

