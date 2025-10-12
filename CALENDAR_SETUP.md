# Google Calendar Integration Setup Guide

This guide will help you set up Google Calendar integration for the NOVA app.

## Prerequisites

- Google Cloud Console account
- Supabase database access

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

## Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Configure the consent screen:
   - User Type: External
   - App name: NOVA (or your app name)
   - User support email: your email
   - Developer contact: your email
3. Click "Add or Remove Scopes" and add:
   - `https://www.googleapis.com/auth/calendar.readonly`
4. **Important: Add Test Users**
   - Under "Test users", click "Add Users"
   - Add your Gmail address that you'll use to test
   - You can add up to 100 test users while in testing mode
5. Save and continue

## Step 3: Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Create OAuth client ID:
   - Application type: Web application
   - Name: NOVA Calendar Integration
   - Authorized redirect URIs:
     - `http://localhost:3000/api/calendar/callback` (for development)
     - `https://yourdomain.com/api/calendar/callback` (for production)
5. Copy the Client ID and Client Secret

## Step 4: Configure Environment Variables

Add the following to your `.env.local` file:

```env
# Google Calendar Integration
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # Change to your production URL in production
```

## Step 5: Run Database Migration

Run the database migration to add calendar fields to the users table:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the SQL in supabase/migrations/20240312000000_add_calendar_fields.sql
```

The migration adds these fields to the `users` table:
- `google_access_token` (TEXT)
- `google_refresh_token` (TEXT)
- `calendar_connected` (BOOLEAN)

## Step 6: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the home page
3. You should see a "Connect Google Calendar" card
4. Click "Connect Calendar" and authorize the app
5. After authorization, you'll be redirected back to the home page
6. Events with keywords like "deadline", "homework", or "assignment" will appear

## How It Works

### Event Detection

The system automatically filters calendar events based on these keywords:
- **Deadlines**: Events with "deadline" or "due" in the title
- **Homework**: Events with "homework" or "hw" in title/description
- **Assignments**: Events with "assignment" or "project" in title/description

### Event Display

- Shows events for the next 14 days
- Displays date in user-friendly format (e.g., "Today", "Tomorrow", "In 3 days")
- Icons indicate event type (🔴 deadline, 📝 homework, 📚 assignment)

### Security

- Access tokens are stored encrypted in Supabase
- Refresh tokens allow long-term access without re-authentication
- Users can disconnect their calendar at any time

## Troubleshooting

### "Calendar not connected" error
- Verify environment variables are set correctly
- Check that the OAuth redirect URI matches exactly in Google Cloud Console
- Ensure the Google Calendar API is enabled

### No events showing
- Make sure your calendar events include the keywords mentioned above
- Check that events are within the next 14 days
- Verify the calendar being used is your primary Google Calendar

### Token expired errors
- The system automatically refreshes tokens when needed
- If issues persist, disconnect and reconnect your calendar

## API Endpoints

- `GET /api/calendar/connect` - Get OAuth URL to start connection
- `GET /api/calendar/callback` - OAuth callback handler
- `GET /api/calendar/events` - Fetch calendar events
- `POST /api/calendar/disconnect` - Disconnect calendar

## Production Deployment

Before deploying to production:

1. Update `NEXT_PUBLIC_BASE_URL` in environment variables
2. Add production redirect URI to Google Cloud Console
3. Consider adding rate limiting to API endpoints
4. Review Google Calendar API quotas and limits
