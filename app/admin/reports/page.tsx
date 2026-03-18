"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FileText, User, MessageSquare, Calendar } from "@/lib/icons";
import { Analytics } from "@/lib/analytics";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

interface Report {
  id: string;
  reporter_id: string;
  reported_type: "post" | "user" | "comment";
  reported_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  reporter?: {
    display_name?: string;
    avatar_url?: string;
  };
}

export default function ReportsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionAction, setResolutionAction] = useState<
    "delete" | "ban" | "no_violation" | null
  >(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  useSkeletonMetric("admin_reports_page", isLoading);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          router.push("/auth");
          return;
        }
        if (bootstrap.profile?.role !== "admin") {
          router.push("/home");
          return;
        }

        // 加载待处理举报（通过安全的 API Route）
        const res = await fetch("/api/admin/reports");
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (err) {
        console.error("[admin-reports] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleResolve = async (reportId: string, action: "delete" | "ban" | "no_violation") => {
    try {
      const response = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action, notes: resolutionNotes.trim() || undefined }),
      });

      const result = await response.json();

      if (result.success) {
        // 获取举报类型用于审计日志
        const report = reports.find((r) => r.id === reportId);
        Analytics.adminReportResolved(reportId, action, report?.reported_type || "unknown");

        toast.success("Report resolved");
        // 重新加载列表（通过安全的 API Route）
        const res = await fetch("/api/admin/reports");
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
        setResolvingId(null);
        setResolutionAction(null);
        setResolutionNotes("");
      } else {
        toast.error("Failed to resolve. Please try again");
      }
    } catch (err) {
      console.error("[admin-reports] resolve error:", err);
      toast.error("Failed to resolve. Please try again");
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "post":
        return <FileText className="w-4 h-4" />;
      case "user":
        return <User className="w-4 h-4" />;
      case "comment":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case "post":
        return "Post";
      case "user":
        return "User";
      case "comment":
        return "Comment";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4 max-w-4xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-surface-raised rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Reports</h1>
          <p className="text-text-tertiary">Review and resolve user reports</p>
        </div>
        <div className="bento-grid mb-6">
          <div className="bento-2x1 card-block p-5">
            <p className="text-sm text-text-tertiary">Pending</p>
            <p className="text-3xl font-bold text-brand-secondary">{reports.length}</p>
          </div>
          <div className="card-block p-5">
            <p className="text-sm text-text-tertiary">Resolved</p>
            <p className="text-3xl font-bold text-success">0</p>
          </div>
          <div className="card-block p-5">
            <p className="text-sm text-text-tertiary">High Risk</p>
            <p className="text-3xl font-bold text-error">0</p>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="card-block p-12 text-center">
            <p className="text-text-tertiary">No pending reports</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => (
              <div key={report.id} className="card-block p-6">
                <div className="flex items-start gap-6">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={report.reporter?.avatar_url || DEFAULT_AVATAR_FAN} />
                    <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary">
                      {report.reporter?.display_name?.[0]?.toUpperCase() || "R"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        {getReportTypeIcon(report.reported_type)}
                        <span className="font-semibold text-text-primary">
                          {getReportTypeLabel(report.reported_type)}
                        </span>
                      </div>
                      <Badge className="bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20 rounded-lg">
                        Pending
                      </Badge>
                      <span className="text-xs text-text-tertiary flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div>
                        <span className="text-sm font-medium text-text-primary">Reason: </span>
                        <span className="text-sm text-text-tertiary">{report.reason}</span>
                      </div>
                      {report.description && (
                        <div>
                          <span className="text-sm font-medium text-text-primary">
                            Description:{" "}
                          </span>
                          <span className="text-sm text-text-tertiary">{report.description}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-medium text-text-primary">Reported by: </span>
                        <span className="text-sm text-text-tertiary">
                          {report.reporter?.display_name ||
                            `User ${report.reporter_id.slice(0, 8)}`}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-border-base">
                      {report.reported_type === "post" && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="border-border-base bg-surface-base hover:bg-surface-raised rounded-xl"
                        >
                          <Link href={`/posts/${report.reported_id}`}>View Post</Link>
                        </Button>
                      )}
                      {report.reported_type === "user" && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="border-border-base bg-surface-base hover:bg-surface-raised rounded-xl"
                        >
                          <Link href={`/creator/${report.reported_id}`}>View User</Link>
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          setResolvingId(report.id);
                          setResolutionAction("delete");
                        }}
                        variant="outline"
                        size="sm"
                        className="border-error text-error hover:bg-error/10 rounded-xl"
                      >
                        {report.reported_type === "post" ? "Delete Content" : "Ban User"}
                      </Button>
                      <Button
                        onClick={() => {
                          setResolvingId(report.id);
                          setResolutionAction("no_violation");
                        }}
                        variant="outline"
                        size="sm"
                        className="border-success text-success hover:bg-success/10 rounded-xl"
                      >
                        No Violation
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resolution Dialog */}
        <AlertDialog
          open={resolvingId !== null && resolutionAction !== null}
          onOpenChange={(open) => {
            if (!open) {
              setResolvingId(null);
              setResolutionAction(null);
              setResolutionNotes("");
            }
          }}
        >
          <AlertDialogContent className="bg-surface-base border-border-base rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-text-primary">
                {resolutionAction === "delete"
                  ? "Delete Content"
                  : resolutionAction === "ban"
                    ? "Ban User"
                    : "Mark as No Violation"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-text-tertiary">
                {resolutionAction === "delete"
                  ? "This will delete the reported content. This action cannot be undone."
                  : resolutionAction === "ban"
                    ? "This will ban the reported user. They will not be able to access the platform."
                    : "This will mark the report as resolved with no violation found."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="resolution_notes">Resolution Notes (Optional)</Label>
                <Textarea
                  id="resolution_notes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add any notes about this resolution..."
                  className="bg-surface-base border-border-base rounded-xl"
                  rows={3}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border-base bg-surface-base hover:bg-surface-raised rounded-xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  resolvingId && resolutionAction && handleResolve(resolvingId, resolutionAction)
                }
                className={`rounded-xl ${
                  resolutionAction === "no_violation"
                    ? "bg-green-500 hover:bg-green-500/90"
                    : "bg-error hover:bg-error/90"
                }`}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
