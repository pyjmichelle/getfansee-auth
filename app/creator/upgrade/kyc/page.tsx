"use client";

import type React from "react";

import { useState } from "react";
import { ArrowLeft, Shield, Upload, CheckCircle, AlertCircle } from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";

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
    avatar: DEFAULT_AVATAR_FAN,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

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
          <Badge
            variant="secondary"
            className="text-[var(--color-pink-600)] bg-pink-100 dark:bg-pink-950"
          >
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-text-tertiary">
            Not Started
          </Badge>
        );
    }
  };

  if (status === "pending") {
    return (
      <PageShell user={currentUser} notificationCount={3} maxWidth="2xl">
        <div className="section-block py-12">
          <div className="card-block p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-4">Verification in Progress</h1>
            <p className="text-text-secondary mb-8">
              Your KYC documents are being reviewed. This typically takes 1-2 business days.
              We&apos;ll notify you via email once the review is complete.
            </p>
            <Button asChild variant="default" className="text-white shadow-glow hover-bold">
              <Link href="/home">Back to Home</Link>
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (status === "approved") {
    return (
      <PageShell user={currentUser} notificationCount={3} maxWidth="2xl">
        <div className="section-block py-12">
          <div className="card-block p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-4">Verification Complete!</h1>
            <p className="text-text-secondary mb-8">
              Congratulations! Your identity has been verified. You can now access all creator
              features and start monetizing your content.
            </p>
            <Button
              asChild
              size="lg"
              variant="default"
              className="text-white shadow-glow hover-bold"
            >
              <Link href="/creator/studio">Go to Creator Studio</Link>
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={3} maxWidth="2xl">
      <div className="section-block py-6">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link href="/me">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">KYC Verification</h1>
            <p className="text-text-secondary">Verify your identity to access creator features</p>
          </div>
          {getStatusBadge()}
        </div>

        <div className="card-block p-6 mb-6 bg-brand-primary/5 border-brand-primary/20">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-brand-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-text-primary mb-2">Why do we need this?</h3>
              <p className="text-sm text-text-secondary">
                Identity verification is required by law to prevent fraud and ensure the safety of
                our community. All information is encrypted and stored securely.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card-block p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-6">Personal Information</h2>

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
                <p className="text-xs text-text-tertiary">You must be 18 or older</p>
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
          </div>

          <div className="card-block p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-6">Upload Documents</h2>

            <div className="space-y-4">
              {[
                { label: "Upload ID Document (Front)", sub: "PNG, JPG or PDF up to 10MB" },
                { label: "Upload ID Document (Back)", sub: "PNG, JPG or PDF up to 10MB" },
                { label: "Upload Selfie", sub: "Clear photo of your face" },
              ].map((doc, i) => (
                <div
                  key={i}
                  className="border-2 border-dashed border-border-base rounded-lg p-8 text-center hover:border-brand-primary/50 transition-colors cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-primary mb-1">{doc.label}</p>
                  <p className="text-xs text-text-tertiary">{doc.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1 bg-transparent">
              <Link href="/me">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="default"
              className="flex-1 text-white shadow-glow hover-bold"
            >
              {isSubmitting ? "Submitting..." : "Submit for Review"}
            </Button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
