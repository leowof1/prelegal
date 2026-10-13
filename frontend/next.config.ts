import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exported to static files in out/ and served by the FastAPI backend.
  output: "export",
  // Emits create/index.html rather than create.html, which FastAPI's StaticFiles serves at /create/.
  trailingSlash: true,
};

export default nextConfig;
