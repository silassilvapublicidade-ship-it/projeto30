import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
            protocol: "https",
          },
        ]
      : [],
  },
  experimental: {
    serverActions: {
      // Next's own default (1MB) is well under the app's validated tip-card
      // image limit (MAX_TIP_IMAGE_SIZE_BYTES, 10MB) - any real photo upload
      // above 1MB was being rejected by the framework itself, before the
      // action or its own file-size validation ever ran. 11mb leaves room
      // for multipart overhead plus the form's other text fields.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
