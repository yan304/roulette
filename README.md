# Name Roulette

Sign in with Google to add your name. An admin spins from `/admin` to jumble every registered name and pick one at random.

- **Next.js 16** (App Router) + Tailwind
- **Supabase** for Google auth, the database, and realtime updates
- The winner is picked inside Postgres (`spin()` function), so every open browser sees the same result and it can't be rigged from the client.

## Setup

### 1. Supabase project
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. Go to **Project Settings → API** and copy the project URL and the publishable (or anon) key.

### 2. Google OAuth
1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** (type: Web application).
2. Add this **Authorized redirect URI**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. In Supabase, go to **Authentication → Sign In / Providers → Google**, enable it, and paste the client ID and secret.
4. In Supabase, go to **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (your production URL later)
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` (and your production `/auth/callback`)

### 3. Create an admin
Only admins can spin. Admins sign in at `/admin` with an email and password.
1. In Supabase, go to **Authentication → Users → Add user → Create new user**. Enter an email and a strong password, and tick **Auto Confirm User**.
2. In the **SQL Editor**, run (with that email):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'admin@example.com';
   ```

### 4. Run it
```bash
cp .env.local.example .env.local   # then fill in the values
npm install
npm run dev
```
Open http://localhost:3000.

## How it works
- Signing in with Google adds your name (from your Google profile) to `participants`. You can remove or re-add it with the button on the page.
- Admins can also type names in by hand (no Google account needed), choose how many winners one spin picks, and switch on **Only players who haven't won** to leave past winners out of the draw.
- Only an admin, signed in at `/admin`, can press **Spin** or remove names. The server calls `spin()`, which checks the caller is in `admins`, picks a random participant, and saves it to `spins`.
- Every open browser receives the new spin via Supabase Realtime and plays the same jumble animation, landing on the same winner.
