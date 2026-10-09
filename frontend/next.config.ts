import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exported to static files in out/ and served by the FastAPI backend.
  output: "export",
  // Emits nda/index.html rather than nda.html, which FastAPI's StaticFiles serves at /nda/.
  trailingSlash: true,
};

export default nextConfig;
