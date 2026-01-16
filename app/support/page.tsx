"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { toast } from "@/hooks/use-toast";

const supabase = getSupabaseBrowserClient();

export default function SupportPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
    email?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth");
        return;
      }

      await ensureProfile();
      const profile = await getProfile(session.user.id);
      if (profile) {
        setCurrentUser({
          username: profile.display_name || "user",
          role: (profile.role || "fan") as "fan" | "creator",
          avatar: profile.avatar_url || undefined,
          email: session.user.email,
        });
        setFormData((prev) => ({
          ...prev,
          email: session.user.email || "",
        }));
      }
    };

    loadUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject || !formData.message) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth");
        return;
      }

      const { error } = await supabase.from("support_tickets").insert({
        user_id: session.user.id,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Your support ticket has been submitted. We will respond via email.",
      });

      // 重置表单
      setFormData({
        email: formData.email,
        subject: "",
        message: "",
      });
    } catch (err) {
      console.error("[support] Submit error:", err);
      toast({
        title: "Error",
        description: "Failed to submit ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Contact Support</h1>
          <p className="text-muted-foreground">
            Submit a support ticket and we'll get back to you via email
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                We'll send our response to this email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief description of your issue"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Please provide details about your issue..."
                rows={8}
                required
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Submitting..." : "Submit Ticket"}
            </Button>
          </form>
        </Card>

        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Common Issues</h2>
          <div className="grid gap-4">
            <Card className="p-4">
              <h3 className="font-medium mb-1">Payment Issues</h3>
              <p className="text-sm text-muted-foreground">
                Problems with wallet recharge or content purchases
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="font-medium mb-1">Account Issues</h3>
              <p className="text-sm text-muted-foreground">
                Login problems, password reset, or profile settings
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="font-medium mb-1">Content Issues</h3>
              <p className="text-sm text-muted-foreground">
                Reporting inappropriate content or technical problems
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
