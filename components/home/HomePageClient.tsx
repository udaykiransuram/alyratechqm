"use client";

import HomePageMarketingClient from "./HomePageMarketingClient";
import type {
  HomeFaq,
  HomeStat,
  HomeTestimonial,
} from "./home-content";

type HomePageClientProps = {
  stats: HomeStat[];
  testimonials: HomeTestimonial[];
  faqs: HomeFaq[];
  testPrice?: number;
  whatsappHref?: string;
};

export default function HomePageClient(props: HomePageClientProps) {
  return <HomePageMarketingClient {...props} />;
}
