"use client";
import { useState, useEffect } from "react";
import { Star, TrendingUp, DollarSign, Users, Shield, ArrowRight } from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useCountUp } from "@/hooks/use-count-up";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";

export default function CreatorUpgradePage() {
  const animatedCreatorCount = useCountUp(2847, { duration: 900, decimals: 0 });
  const animatedKeepShare = useCountUp(80, { duration: 900, decimals: 0 });
  const animatedFeeShare = useCountUp(20, { duration: 900, decimals: 0 });
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const bootstrap = await getAuthBootstrap();
      if (bootstrap.authenticated && bootstrap.user && bootstrap.profile) {
        setCurrentUser({
          username: bootstrap.profile.display_name || bootstrap.user.email?.split("@")[0] || "user",
          role: (bootstrap.profile.role || "fan") as "fan" | "creator",
          avatar: bootstrap.profile.avatar_url || undefined,
        });
      }
    };
    loadUser();
  }, []);

  const benefits = [
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "Monetize Your Content",
      description: "Set subscription prices and earn from PPV content",
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Build Your Community",
      description: "Connect with fans and grow your subscriber base",
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Analytics & Insights",
      description: "Track your performance and optimize your content",
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Secure Platform",
      description: "Your content is protected with industry-leading security",
    },
  ];

  const steps = [
    {
      number: "1",
      title: "Apply to Become a Creator",
      description: "Fill out a quick application form",
    },
    {
      number: "2",
      title: "Complete KYC Verification",
      description: "Verify your identity for security and compliance",
    },
    {
      number: "3",
      title: "Start Creating",
      description: "Upload content and start earning",
    },
  ];

  return (
    <PageShell user={currentUser} notificationCount={3} maxWidth="5xl">
      <div className="py-6 md:py-10">
        {/* Hero Section */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-accent/10 text-brand-accent text-xs md:text-sm font-medium mb-4">
            <Star className="w-3.5 h-3.5" />
            Start Earning Today
          </div>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-text-primary mb-3 text-balance">
            Become a Creator on GetFanSee
          </h1>
          <p className="text-base md:text-lg text-text-secondary mb-4 text-balance max-w-2xl mx-auto">
            Share exclusive content, build your fanbase, and earn money doing what you love. Join
            thousands of creators already making money on our platform.
          </p>
          <p className="text-sm text-text-secondary mb-6">
            Join{" "}
            <span className="font-bold text-gradient-primary">
              {animatedCreatorCount.toFixed(0)}
            </span>{" "}
            creators already earning on GetFanSee.
          </p>
          <Button
            asChild
            size="lg"
            variant="subscribe-gradient"
            className="h-11 md:h-12 px-6 md:px-8 font-bold shadow-glow hover-bold"
          >
            <Link href="/creator/upgrade/apply">
              Start Your Application
              <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {/* Benefits Grid */}
        <div className="mb-8 md:mb-12">
          <h2 className="text-xl md:text-2xl font-bold text-text-primary text-center mb-4 md:mb-6">
            Creator Benefits
          </h2>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="card-block p-4 md:p-6">
                <div className="w-9 h-9 md:w-12 md:h-12 rounded-lg bg-brand-accent/10 text-brand-accent flex items-center justify-center mb-3">
                  {benefit.icon}
                </div>
                <h3 className="text-sm md:text-base font-semibold text-text-primary mb-1">
                  {benefit.title}
                </h3>
                <p className="text-xs md:text-sm text-text-tertiary">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-8 md:mb-12">
          <h2 className="text-xl md:text-2xl font-bold text-text-primary text-center mb-4 md:mb-6">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="card-block p-4 md:p-6 h-full flex gap-4 md:flex-col md:gap-0">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-brand-primary text-white flex items-center justify-center text-base md:text-xl font-bold shrink-0 md:mb-3">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold text-text-primary mb-1">
                      {step.title}
                    </h3>
                    <p className="text-xs md:text-sm text-text-tertiary">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-8 -translate-y-1/2 w-6 h-6 text-text-tertiary" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Info */}
        <div className="card-block bg-gradient-subtle p-5 md:p-8 text-center mb-8 md:mb-12">
          <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">
            Creator Revenue Share
          </h2>
          <div className="flex items-center justify-center gap-4 md:gap-6 mb-3">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-gradient-primary mb-1">
                {animatedKeepShare.toFixed(0)}%
              </div>
              <p className="text-sm text-text-tertiary">You Keep</p>
            </div>
            <div className="text-3xl text-text-tertiary">/</div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-text-tertiary mb-1">
                {animatedFeeShare.toFixed(0)}%
              </div>
              <p className="text-sm text-text-tertiary">Platform Fee</p>
            </div>
          </div>
          <p className="text-sm text-text-tertiary">
            Industry-leading revenue share with fast payouts
          </p>
        </div>

        {/* CTA */}
        <div className="card-block p-5 md:p-8 text-center bg-gradient-subtle border-brand-primary/20">
          <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3">
            Ready to Get Started?
          </h2>
          <p className="text-sm md:text-base text-text-tertiary mb-2 max-w-xl mx-auto">
            Join our creator community and start earning today. The application takes less than 5
            minutes to complete.
          </p>
          <p className="text-sm text-text-secondary mb-5">
            Social proof: {animatedCreatorCount.toFixed(0)}+ creators and growing.
          </p>
          <Button
            asChild
            size="lg"
            variant="subscribe-gradient"
            className="h-11 md:h-12 px-6 md:px-8 font-bold shadow-glow hover-bold"
          >
            <Link href="/creator/upgrade/apply">Apply Now</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
