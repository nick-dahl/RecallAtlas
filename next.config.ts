import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingIncludes: {
    '/**': ['./content/flags/**/*', './content/maps/**/*', './content/portraits/**/*', './content/paintings/**/*'],
  },
};

export default nextConfig;
