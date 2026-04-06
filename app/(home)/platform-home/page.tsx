import HomePageClient from "@/components/home/HomePageClient";
import { getPlatformHomePageData } from "@/lib/server/public-marketing";

export const revalidate = 60;

export const metadata = {
  title: "Alyra Tech | Premium School Intelligence Platform",
  description:
    "Alyra Tech reveals the hidden learning patterns behind performance and connects diagnostics, reports, OMR, and school workflows in one premium platform for school leaders.",
};

export default async function PlatformHomePage() {
  const { stats, testPrice, testimonials, faqs, whatsappHref } =
    await getPlatformHomePageData();

  return (
    <HomePageClient
      stats={stats}
      testimonials={testimonials}
      faqs={faqs}
      testPrice={testPrice}
      whatsappHref={whatsappHref}
    />
  );
}
