import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Keep pdf-parse external to avoid ESM/CJS bundling issues
  serverExternalPackages: ["pdf-parse"],
  // Ensure pdf-parse and pdfjs-dist are included in serverless bundle
  outputFileTracingIncludes: {
    "/api/parse-cv": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
    ],
  },
};

export default nextConfig;
