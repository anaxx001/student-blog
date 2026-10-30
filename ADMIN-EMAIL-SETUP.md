# Admin email setup

Run these steps once from the blog repository on your computer.

1. Install and sign in to the Supabase CLI, then link the repository to the existing Supabase project if it is not linked already.
2. Deploy the function: `supabase functions deploy send-email`
3. Add the Resend key as a Supabase secret: `supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY`
4. The function also uses the Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment values to read subscribers. They are supplied to deployed Supabase Edge Functions automatically.
5. Run `email-automation.sql` once in Supabase Dashboard, SQL Editor, then reload the admin page.

You can also create the Edge Function in the Supabase Dashboard and set `RESEND_API_KEY` in the function's Secrets settings. Do not put the key in the blog files. The current sender is Resend's test sender `onboarding@resend.dev`; replace the `SENDER` constant in `supabase/functions/send-email/index.ts` after verifying the blog's own sending domain in Resend.
