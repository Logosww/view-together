import type { NextConfig } from "next"

const libsqlPackages = [
  "@libsql/client",
  "@libsql/core",
  "@libsql/hrana-client",
  "@libsql/isomorphic-ws",
  "@prisma/adapter-libsql",
  "libsql",
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    turbopackRustReactCompiler: true,
  },
  serverExternalPackages: ["@prisma/client", "prisma", ...libsqlPackages],
}

export default nextConfig
