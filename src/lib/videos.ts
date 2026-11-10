// Cloudflare Stream configuration for the application's two explainer videos.
//
// These are intentionally blank. Until they're filled in, the video buttons
// in the app render a "video coming soon" placeholder instead of a broken
// embed — see VideoModal.tsx.
//
// To wire in the real videos:
//   1. Upload each video via the Cloudflare dashboard: Stream -> Upload.
//   2. Copy the video's UID (shown on its detail page, or in the embed code
//      Cloudflare generates for it) into WELCOME_VIDEO_ID / CREDENTIALING_VIDEO_ID.
//   3. Copy your account's Stream customer code (the "customer-XXXXXXXX" part
//      of that same embed code) into CUSTOMER_CODE.
export const CLOUDFLARE_STREAM_CUSTOMER_CODE = "";

export const WELCOME_VIDEO_ID = "";
export const CREDENTIALING_VIDEO_ID = "";

export function streamEmbedUrl(videoId: string): string | null {
  if (!videoId || !CLOUDFLARE_STREAM_CUSTOMER_CODE) return null;
  return `https://customer-${CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${videoId}/iframe`;
}
