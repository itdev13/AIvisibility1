import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, abs } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PAGES.map((p) => ({ url: abs(p.path), lastModified, changeFrequency: p.changeFrequency, priority: p.priority }));
}
