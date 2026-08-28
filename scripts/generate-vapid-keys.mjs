/**
 * Prints a fresh VAPID keypair for Web Push.
 * Paste the values into `.env.local`.
 *
 * Usage: node scripts/generate-vapid-keys.mjs
 */
import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
console.log("VAPID_SUBJECT=mailto:hello@pagemate.app");
