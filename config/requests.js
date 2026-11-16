/* The form posts to a Cloudflare Worker. The endpoint is public.
   The GitHub token stays in the Worker, not in this file.
   Leave endpoint empty until the Worker is deployed. Scarlet Thread then
   shows "Requests open soon".
   turnstileSiteKey is the public Turnstile site key. The matching secret
   stays in the Worker. */

window.scarletRequests = {
  endpoint: "",
  turnstileSiteKey: "",
  repo: "netpaddler/Scarlett-thread",
  label: "map-request"
};
