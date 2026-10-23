# Admin setup (Supabase Auth)

The admin now signs in with a real Supabase account (email + password). Only the one owner account you claim can read subscribers, moderate comments, edit posts, or upload images. The old username/password login that lived in the browser has been removed.

## One-time setup

1. Open the Supabase dashboard for this project, then SQL Editor > New query.
2. Run `setup.sql` if you haven't already, then run `setup-v4.sql`, then run `setup-v5.sql`. All three are safe to re-run. Paste each whole file and press Run.
3. Storage: make sure a bucket named `media` exists and is Public (Storage > New bucket, if it's missing).
4. Open `admin.html?setup=1` on your site (for example `https://anaxx001.github.io/student-blog/admin.html?setup=1`).
5. Fill in your email and a password (at least 8 characters), then tap "Create owner account".
6. If Supabase asks you to confirm your email, open that email and click the link first. Then open `admin.html?setup=1` again and log in with the same email and password. The first signed-in account to claim admin becomes the owner.
7. Once the owner exists, `?setup=1` stops offering setup and only shows the login. Nobody else can become admin.

If you ever need to reset your password, tap "Forgot password" on the login screen, and Supabase emails a reset link. Or, once logged in, use the Account tab to change it.

## What changed

- `setup-v5.sql` (new): adds an `admins` table (one owner row), `is_admin()`, `setup_open()`, and `claim_admin()` functions. Rewrites the policies so:
  - Public visitors read published posts, approved comments, enabled ads, settings, and reaction counts.
  - Anyone can subscribe with an email. Only the owner can read or delete subscribers.
  - Only the owner can insert, update, or delete posts, comments moderation, settings, ads, and uploaded images.
  - The public subscriber count still works through `subscriber_count()`.
- `supabase.js`: adds a `DB.auth` API (sign in, sign up, reset password, change password, sign out, check owner, claim owner). The session is stored by Supabase. Admin calls now throw real errors instead of quietly using the local copy (`DB.strict`). The public site still falls back to local data when Supabase is unreachable.
- `admin.js`: the username/password login is removed. The page shows the login, owner setup (only while no owner exists), or the admin. If the signed-in account is not the owner, it signs them out. The Account tab now changes the password (after checking the current one) and signs out. The eye toggle is on every password field.
- `admin.html`: the login, setup, reset, and account forms are rebuilt to match. Each password field has an eye toggle.
- `admin-v4.css`: styles for the eye toggle.
- The public pages (index, post, category) and their anon reads are unchanged.

## Notes

- The "Forgot password" email depends on Supabase's email settings (Authentication > Emails). If the reset email never arrives, check there, or change the password while logged in.
- Keep the anon key in `supabase.js`. It is public by design. Security now comes from the policies, not from hiding the key.
