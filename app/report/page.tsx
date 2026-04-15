import ReportPageClient from "./ReportPageClient";
import type { ReportType } from "@/lib/reports";

type ReportPageProps = {
  searchParams: Promise<{
    type?: string | string[];
    id?: string | string[];
    postId?: string | string[];
    creatorId?: string | string[];
  }>;
};

const isReportType = (value: string | undefined): value is ReportType => {
  return value === "post" || value === "comment" || value === "user";
};

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const resolvedParams = await searchParams;
  const typeParam = typeof resolvedParams.type === "string" ? resolvedParams.type : undefined;
  const idParam = typeof resolvedParams.id === "string" ? resolvedParams.id : "";
  const postIdParam = typeof resolvedParams.postId === "string" ? resolvedParams.postId : "";
  const creatorIdParam =
    typeof resolvedParams.creatorId === "string" ? resolvedParams.creatorId : "";

  const initialType: ReportType = isReportType(typeParam) ? typeParam : "post";
  const initialId = idParam || postIdParam || creatorIdParam || "";

  return (
    <ReportPageClient
      initialType={initialType}
      initialId={initialId}
      postId={postIdParam || undefined}
      creatorId={creatorIdParam || undefined}
    />
  );
}
