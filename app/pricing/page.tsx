import { Metadata } from "next";
import { PricingPageClient } from "./PricingPageClient";

export const metadata: Metadata = {
  title: "Pricing - GetFanSee",
  description:
    "Transparent pricing for GetFanSee — subscription tiers, pay-per-view, and creator earnings.",
};

export default function PricingPage() {
  return <PricingPageClient />;
}
