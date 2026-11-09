import { JsonLd } from "@/components/jsonld";
import { SiteFooter, SiteNav } from "@/components/marketing";
import { siteGraph } from "@/lib/seo";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={siteGraph()} />
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
