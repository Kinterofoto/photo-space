import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.module.parser = {
      ...config.module.parser,
      javascript: {
        ...config.module.parser?.javascript,
        url: false,
      },
    }
    return config
  },
}

export default nextConfig
