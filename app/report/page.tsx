import ReportPageClient from "./ReportPageClient";
import type { ReportType } from "@/lib/reports";

type ReportPageProps = {
  searchParams: {
    type?: string | string[];
    id?: string | string[];
  };
};

const isReportType = (value: string | undefined): value is ReportType => {
  return value === "post" || value === "comment" || value === "user";
};

export default function ReportPage({ searchParams }: ReportPageProps) {
  const typeParam = typeof searchParams.type === "string" ? searchParams.type : undefined;
  const idParam = typeof searchParams.id === "string" ? searchParams.id : "";

  const initialType: ReportType = isReportType(typeParam) ? typeParam : "post";
  const initialId = idParam || "";

  return <ReportPageClient initialType={initialType} initialId={initialId} />;
}
