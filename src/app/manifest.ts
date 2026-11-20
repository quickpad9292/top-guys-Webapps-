import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cognithan",
    short_name: "Cognithan",
    description: "Notes that think with you — block editor, live collaboration and AI.",
    start_url: "/notes",
    scope: "/",
    display: "standalone",
    background_color: "#0b0912",
    theme_color: "#7c3aed",
    orientation: "any",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "All notes", url: "/notes" }],
  };
}
