// Google settings for shared albums. The client ID is the team's iOS OAuth
// client (Google Cloud project "Memora", bundle ID com.memora.app). It's a
// public identifier, not a secret. If you change it, change the matching URL
// scheme in app.json too.
export const GOOGLE_IOS_CLIENT_ID = '3175320174-8b2338h3id3vgq3sn7esqeo1cbtkvk6a.apps.googleusercontent.com';

/** Google sends you back to the app through the reversed client ID. */
export const GOOGLE_REDIRECT_URI = `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.replace(
  '.apps.googleusercontent.com',
  '',
)}:/oauthredirect`;

/**
 * Full Drive access. The narrow drive.file permission was tested and doesn't
 * let invited friends see an album (see scripts/drive-share-test.mjs).
 * Fine while the Google project is in Testing mode (up to 100 test users).
 */
export const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive'];

export const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/** Photos are resized to this many pixels on the long side before upload. */
export const UPLOAD_MAX_SIDE = 2048;
export const UPLOAD_QUALITY = 0.85;
/** How many photos upload at once. */
export const UPLOAD_CONCURRENCY = 3;
