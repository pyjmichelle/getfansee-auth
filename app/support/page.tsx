"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { toast } from "sonner";
import { HelpCircle, CreditCard, User, AlertTriangle, Send, Loader2 } from "@/lib/icons";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";

const supabase = getSupabaseBrowserClient();

export default function SupportPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
    email?: string;
    id?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    const loadUser = async () => {
      const bootstrap = await getAuthBootstrap();
      if (bootstrap.authenticated && bootstrap.user && bootstrap.profile) {
        setCurrentUser({
          username: bootstrap.profile.display_name || "user",
          role: (bootstrap.profile.role || "fan") as "fan" | "creator",
          avatar: bootstrap.profile.avatar_url || undefined,
          email: bootstrap.user.email,
          id: bootstrap.user.id,
        });
        setFormData((prev) => ({
          ...prev,
          email: bootstrap.user!.email || "",
        }));
      }
    };

    loadUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.subject || !formData.message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const bootstrap = await getAuthBootstrap();
      const userId = bootstrap.authenticated ? bootstrap.user?.id : null;

      const { error } = await supabase.from("support_tickets").insert({
        ...(userId ? { user_id: userId } : {}),
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
      toast.success("Support ticket submitted! We'll respond via email within 24 hours.");

      setFormData({
        email: formData.email,
        subject: "",
        message: "",
      });
    } catch (err) {
      console.error("[support] Submit error:", err);
      toast.error("Failed to submit ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqItems = [
    {
      icon: CreditCard,
      title: "Payment Issues",
      description: "Problems with wallet recharge or content purchases",
      color: "text-brand-accent",
      bg: "bg-brand-accent/10",
    },
    {
      icon: User,
      title: "Account Issues",
      description: "Login problems, password reset, or profile settings",
      color: "text-brand-primary",
      bg: "bg-brand-primary-alpha-10",
    },
    {
      icon: AlertTriangle,
      title: "Content Issues",
      description: "Reporting inappropriate content or technical problems",
      color: "text-error",
      bg: "bg-error/10",
    },
  ];

  const userForShell = currentUser
    ? { username: currentUser.username, role: currentUser.role, avatar: currentUser.avatar }
    : null;

  return (
    <PageShell user={userForShell} notificationCount={0} maxWidth="5xl">
      <div className="pb-24">
        {/* Hero Banner */}
        <div className="card-block bg-gradient-subtle p-6 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-primary-alpha-10 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-brand-primary" aria-hidden="true" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Contact Support</h1>
          </div>
          <p className="text-text-secondary">
            Submit a support ticket and we&apos;ll get back to you via email within 24 hours. No
            account required.
          </p>
        </div>

        {submitted ? (
          <div className="card-block p-8 text-center">
            <div className="w-14 h-14 bg-brand-primary-alpha-10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 text-brand-primary" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Ticket Submitted!</h2>
            <p className="text-text-secondary mb-6">
              We&apos;ve received your request and will respond to{" "}
              <strong>{formData.email || "your email"}</strong> within 24 hours on weekdays.
            </p>
            <Button
              variant="outline"
              onClick={() => setSubmitted(false)}
              className="bg-transparent"
            >
              Submit Another Ticket
            </Button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Form */}
            <div className="flex-1">
              <div className="card-block p-6 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-text-primary font-semibold">
                      Email Address <span className="text-error">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="your@email.com"
                      required
                      className="bg-surface-raised border-border-base rounded-xl focus-visible:ring-brand-primary"
                    />
                    <p className="text-xs text-text-tertiary">
                      We&apos;ll send our response to this email address
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-text-primary font-semibold">
                      Subject <span className="text-error">*</span>
                    </Label>
                    <Input
                      id="subject"
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Brief description of your issue"
                      required
                      className="bg-surface-raised border-border-base rounded-xl focus-visible:ring-brand-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-text-primary font-semibold">
                      Message <span className="text-error">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Please provide details about your issue..."
                      rows={8}
                      required
                      className="bg-surface-raised border-border-base rounded-xl resize-none focus-visible:ring-brand-primary"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[52px] bg-brand-primary text-white font-bold rounded-xl hover-bold shadow-glow active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Ticket
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-text-tertiary text-center">
                    For billing disputes, please include your transaction date and amount.
                    Alternatively, email us directly at{" "}
                    <a
                      href="mailto:support@getfansee.com"
                      className="text-brand-primary hover:underline"
                    >
                      support@getfansee.com
                    </a>
                  </p>
                </form>
              </div>
            </div>

            {/* Sidebar: FAQ */}
            <aside className="w-full lg:w-72 shrink-0">
              <div className="sticky top-24 space-y-3">
                <h2 className="text-base font-semibold text-text-primary px-1">Common Issues</h2>
                {faqItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="card-block p-4 hover-bold">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0`}
                        >
                          <Icon className={`w-5 h-5 ${item.color}`} aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-text-primary text-sm mb-0.5">
                            {item.title}
                          </h3>
                          <p className="text-xs text-text-tertiary leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="card-block p-4 bg-brand-primary-alpha-10 border-brand-primary/20">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    <span className="font-semibold text-brand-primary">Response time:</span> Usually
                    within 24 hours on weekdays.
                  </p>
                </div>
                <div className="card-block p-4">
                  <p className="text-xs text-text-tertiary leading-relaxed">
                    See our{" "}
                    <a href="/faq" className="text-brand-primary hover:underline">
                      FAQ
                    </a>{" "}
                    for quick answers, or our{" "}
                    <a href="/refund" className="text-brand-primary hover:underline">
                      Refund Policy
                    </a>{" "}
                    for billing questions.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </PageShell>
  );
}
