import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Personal Lab Archive",
    short_name: "Lab Archive",
    description:
      "Mobile-first personal archive for physics, electronics, and microcontroller lab files synced from Google Drive and Sheets.",
    start_url: "/",
    display: "standalone",
    background_color: "#070a12",
    theme_color: "#0b0f19",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}