import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LoadSprint Driver",
    short_name: "LoadSprint",
    description: "Loads, files, cargo photos and delivery for LoadSprint drivers.",
    start_url: "/driver",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B1120",
    theme_color: "#0F172A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
