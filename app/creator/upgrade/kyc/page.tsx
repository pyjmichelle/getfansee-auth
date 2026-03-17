"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Shield, Upload, CheckCircle, AlertCircle } from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";

type KYCStatus = "not_started" | "pending" | "approved" | "failed";

export default function KYCPage() {
  const [status, setStatus] = useState<KYCStatus>("not_started");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    country: "",
    idType: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAuthBootstrap().then((bootstrap) => {
      if (bootstrap.authenticated && bootstrap.profile) {
        setCurrentUser({
          username: bootstrap.profile.display_name || "user",
          role: (bootstrap.profile.role || "fan") as "fan" | "creator",
          avatar: bootstrap.profile.avatar_url || undefined,
        });
      }
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.dateOfBirth || !formData.idType) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("fullName", formData.fullName);
      fd.append("dateOfBirth", formData.dateOfBirth);
      fd.append("country", formData.country || "Not specified");
      fd.append("idType", formData.idType);
      for (const file of selectedFiles) {
        fd.append("documents", file);
      }

      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Submission failed");
      }

      setStatus("pending");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submission failed. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
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
      <PageShell user={currentUser} notificationCount={0} maxWidth="2xl">
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
      <PageShell user={currentUser} notificationCount={0} maxWidth="2xl">
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
    <PageShell user={currentUser} notificationCount={0} maxWidth="2xl">
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
                <Label htmlFor="country">Country of Residence</Label>
                <Input
                  id="country"
                  placeholder="e.g., United States, United Kingdom"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
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
            <p className="text-sm text-text-secondary mb-4">
              Upload your ID document (front &amp; back) and a selfie. Accepted formats: JPG, PNG,
              PDF (max 10MB each).
            </p>

            <div
              className="border-2 border-dashed border-border-base rounded-lg p-8 text-center hover:border-brand-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm font-medium text-text-primary mb-1">
                Click to select documents
              </p>
              <p className="text-xs text-text-tertiary">
                ID front, ID back, selfie — you can select multiple files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {selectedFiles.length > 0 && (
              <ul className="mt-3 space-y-1">
                {selectedFiles.map((file, i) => (
                  <li key={i} className="text-xs text-text-secondary flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
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
