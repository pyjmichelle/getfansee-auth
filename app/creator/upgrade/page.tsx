"use client";
import { Star, TrendingUp, DollarSign, Users, Shield, ArrowRight } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function CreatorUpgradePage() {
  const currentUser = {
    username: "john_doe",
    role: "fan" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  };

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
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={3} />

      <main className="container max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
            <Star className="w-4 h-4" />
            Start Earning Today
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            Become a Creator on GetFanSee
          </h1>
          <p className="text-lg text-muted-foreground mb-8 text-balance max-w-2xl mx-auto">
            Share your content, connect with fans, and earn money doing what you love. Join
            thousands of creators already earning on our platform.
          </p>
          <Button asChild size="lg" className="h-12 px-8">
            <Link href="/creator/upgrade/apply">
              Start Your Application
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>

        {/* Benefits Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Creator Benefits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="p-6">
                <div className="w-12 h-12 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-4">
                  {benefit.icon}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <Card className="p-6 h-full">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </Card>
                {index < steps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-8 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Info */}
        <Card className="p-8 text-center mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">Creator Revenue Share</h2>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary mb-2">80%</div>
              <p className="text-muted-foreground">You Keep</p>
            </div>
            <div className="text-4xl text-muted-foreground">/</div>
            <div className="text-center">
              <div className="text-5xl font-bold text-muted-foreground mb-2">20%</div>
              <p className="text-muted-foreground">Platform Fee</p>
            </div>
          </div>
          <p className="text-muted-foreground">Industry-leading revenue share with fast payouts</p>
        </Card>

        {/* CTA */}
        <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <h2 className="text-2xl font-bold text-foreground mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Join our creator community and start monetizing your content today. The application
            takes less than 5 minutes.
          </p>
          <Button asChild size="lg" className="h-12 px-8">
            <Link href="/creator/upgrade/apply">Apply Now</Link>
          </Button>
        </Card>
      </main>
    </div>
  );
}
