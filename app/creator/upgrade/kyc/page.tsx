"use client";

import type React from "react";

import { useState } from "react";
import { ArrowLeft, Shield, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type KYCStatus = "not_started" | "pending" | "approved" | "failed";

export default function KYCPage() {
  const [status, setStatus] = useState<KYCStatus>("not_started");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    address: "",
    idType: "",
  });

  const currentUser = {
    username: "john_doe",
    role: "fan" as const,
    avatar: "/placeholder.svg?height=100&width=100",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setStatus("pending");
    }, 2000);
  };

  const getStatusBadge = () => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="text-yellow-600 bg-yellow-100 dark:bg-yellow-950">
            Pending Review
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="secondary" className="text-green-600 bg-green-100 dark:bg-green-950">
            Approved
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="secondary" className="text-red-600 bg-red-100 dark:bg-red-950">
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-muted-foreground">
            Not Started
          </Badge>
        );
    }
  };

  if (status === "pending") {
    return (
      <div className="min-h-screen bg-background">
        <NavHeader user={currentUser} notificationCount={3} />

        <main className="container max-w-2xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Verification in Progress</h1>
            <p className="text-muted-foreground mb-8">
              Your KYC documents are being reviewed. This typically takes 1-2 business days. We'll
              notify you via email once the review is complete.
            </p>
            <Button asChild>
              <Link href="/home">Back to Home</Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="min-h-screen bg-background">
        <NavHeader user={currentUser} notificationCount={3} />

        <main className="container max-w-2xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Verification Complete!</h1>
            <p className="text-muted-foreground mb-8">
              Congratulations! Your identity has been verified. You can now access all creator
              features and start monetizing your content.
            </p>
            <Button asChild size="lg">
              <Link href="/creator/studio">Go to Creator Studio</Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={3} />

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link href="/me">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">KYC Verification</h1>
            <p className="text-muted-foreground">Verify your identity to access creator features</p>
          </div>
          {getStatusBadge()}
        </div>

        <Card className="p-6 mb-6 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground mb-2">Why do we need this?</h3>
              <p className="text-sm text-muted-foreground">
                Identity verification is required by law to prevent fraud and ensure the safety of
                our community. All information is encrypted and stored securely.
              </p>
            </div>
          </div>
        </Card>

        <form onSubmit={handleSubmit}>
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Personal Information</h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Legal Name *</Label>
                <Input
                  id="fullName"
                  placeholder="As shown on your ID"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  required
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">You must be 18 or older</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Residential Address *</Label>
                <Input
                  id="address"
                  placeholder="Street address, city, state, zip"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idType">ID Document Type *</Label>
                <Input
                  id="idType"
                  placeholder="e.g., Passport, Driver's License"
                  value={formData.idType}
                  onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                  required
                  className="h-11"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Upload Documents</h2>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  Upload ID Document (Front)
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG or PDF up to 10MB</p>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  Upload ID Document (Back)
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG or PDF up to 10MB</p>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Upload Selfie</p>
                <p className="text-xs text-muted-foreground">Clear photo of your face</p>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1 bg-transparent">
              <Link href="/me">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Submitting..." : "Submit for Review"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
