"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { listPendingReports, resolveReport } from "@/lib/reports";
import { FileText, User, MessageSquare, Calendar } from "lucide-react";
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

const supabase = getSupabaseBrowserClient();

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
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionAction, setResolutionAction] = useState<
    "delete" | "ban" | "no_violation" | null
  >(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

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
          });

          // TODO: 检查是否为管理员
        }

        // 加载待处理举报
        const pending = await listPendingReports();
        setReports(pending);
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
      const success = await resolveReport(reportId, action, resolutionNotes.trim() || undefined);

      if (success) {
        toast.success("Report resolved");
        // 重新加载列表
        const pending = await listPendingReports();
        setReports(pending);
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
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted rounded-3xl"></div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Reports</h1>
          <p className="text-muted-foreground">Review and resolve user reports</p>
        </div>

        {reports.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-12 text-center">
            <p className="text-muted-foreground">No pending reports</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-card border border-border rounded-3xl p-6 hover:border-border transition-colors"
              >
                <div className="flex items-start gap-6">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={report.reporter?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {report.reporter?.display_name?.[0]?.toUpperCase() || "R"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        {getReportTypeIcon(report.reported_type)}
                        <span className="font-semibold text-foreground">
                          {getReportTypeLabel(report.reported_type)}
                        </span>
                      </div>
                      <Badge className="bg-[var(--bg-purple-500-10)] text-[var(--color-purple-400)] border-[var(--border-purple-500-20)] rounded-lg">
                        Pending
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div>
                        <span className="text-sm font-medium text-foreground">Reason: </span>
                        <span className="text-sm text-muted-foreground">{report.reason}</span>
                      </div>
                      {report.description && (
                        <div>
                          <span className="text-sm font-medium text-foreground">Description: </span>
                          <span className="text-sm text-muted-foreground">
                            {report.description}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-medium text-foreground">Reported by: </span>
                        <span className="text-sm text-muted-foreground">
                          {report.reporter?.display_name ||
                            `User ${report.reporter_id.slice(0, 8)}`}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-border">
                      {report.reported_type === "post" && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="border-border bg-card hover:bg-card rounded-xl"
                        >
                          <Link href={`/post/${report.reported_id}`}>View Post</Link>
                        </Button>
                      )}
                      {report.reported_type === "user" && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="border-border bg-card hover:bg-card rounded-xl"
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
                        className="border-destructive text-destructive hover:bg-destructive/10 rounded-xl"
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
                        className="border-green-500 text-green-600 dark:text-green-400 hover:bg-green-500/10 rounded-xl"
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
          <AlertDialogContent className="bg-card border-border rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                {resolutionAction === "delete"
                  ? "Delete Content"
                  : resolutionAction === "ban"
                    ? "Ban User"
                    : "Mark as No Violation"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
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
                  className="bg-card border-border rounded-xl"
                  rows={3}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border bg-card hover:bg-card rounded-xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  resolvingId && resolutionAction && handleResolve(resolvingId, resolutionAction)
                }
                className={`rounded-xl ${
                  resolutionAction === "no_violation"
                    ? "bg-green-500 hover:bg-green-500/90"
                    : "bg-destructive hover:bg-destructive/90"
                }`}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
