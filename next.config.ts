import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@tensorflow/tfjs-node", "canvas", "@vladmandic/human"],
}

export default nextConfig
