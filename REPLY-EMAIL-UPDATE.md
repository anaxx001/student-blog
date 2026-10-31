Reply email deployment note

Paste the updated contents of `supabase/functions/send-email/index.ts` into the `send-email` Edge Function in the Supabase dashboard, then redeploy that function. Until it is redeployed, the live email function will not use the new replier label fields.

The author-comment badge requires the `is_author` column. Run this once in the Supabase SQL Editor:

```sql
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_author boolean NOT NULL DEFAULT false;
```
