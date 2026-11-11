# Google Business Profile project

Set `GOOGLE_BUSINESS_CLIENT_ID` and `GOOGLE_BUSINESS_CLIENT_SECRET` together in Vercel production for the dedicated OAuth web client in the approved Google Cloud project. These server-only variables apply to Business Profile authorization and token refresh. Google sign-in and Calendar continue using `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Authorized redirect URI: `https://bookeasy.ro/api/oauth/google/callback` (add the www variant only if initiating connections on www is supported).

Both dedicated variables absent preserves the existing configuration; a partial pair fails closed. Existing refresh tokens from the previous OAuth client can still refresh using the legacy credential pair, only after Google explicitly rejects the new client binding. Provider failures and quota responses do not trigger retries.

The Cloud project must have approved Business Profile API access and the required APIs enabled. A quota of zero requires approval; enabled status alone is insufficient. After deployment, restart authorization from BookEasy Settings and verify the Google URL uses the approved project's client ID. Grant consent as the owner/manager of the intended Business Profile, then select that location in BookEasy.
