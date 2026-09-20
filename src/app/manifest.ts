import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** PWA manifest (task 43): installable feed, brand icons, light theme. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: "no reality",
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      {
        src: "/images/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/images/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
