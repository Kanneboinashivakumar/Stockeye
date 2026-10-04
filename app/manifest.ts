import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stockeye",
    short_name: "Stockeye",
    description: "Digitize a shop shelf by talking while you point the camera.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F5F0",
    theme_color: "#1E5B43",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
