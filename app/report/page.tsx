import ReportPageClient from "./ReportPageClient";
import type { ReportType } from "@/lib/reports";

type ReportPageProps = {
  searchParams: Promise<{
    type?: string | string[];
    id?: string | string[];
  }>;
};

const isReportType = (value: string | undefined): value is ReportType => {
  return value === "post" || value === "comment" || value === "user";
};

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const resolvedParams = await searchParams;
  const typeParam = typeof resolvedParams.type === "string" ? resolvedParams.type : undefined;
  const idParam = typeof resolvedParams.id === "string" ? resolvedParams.id : "";

  const initialType: ReportType = isReportType(typeParam) ? typeParam : "post";
  const initialId = idParam || "";

  return <ReportPageClient initialType={initialType} initialId={initialId} />;
}
