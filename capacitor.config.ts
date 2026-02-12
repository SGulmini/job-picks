import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jobpicks.app",
  appName: "Job Picks",
  webDir: "capacitor-webdir",

  // Remote mode: the WebView loads your Vercel deployment directly.
  // Replace <MY_VERCEL_DOMAIN> with your actual domain (e.g. job-picks.vercel.app).
  server: {
    url: "https://<MY_VERCEL_DOMAIN>",
    cleartext: false,
  },

  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Job Picks",
  },

  android: {
    // Allow mixed content if needed; false keeps HTTPS-only
    allowMixedContent: false,
  },
};

export default config;
