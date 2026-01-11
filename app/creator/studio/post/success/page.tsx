import PublishSuccessPageClient from "./PublishSuccessPageClient";

type PublishSuccessPageProps = {
  searchParams: {
    type?: string | string[];
    price?: string | string[];
  };
};

type PublishType = "free" | "subscribers" | "ppv";

const isPublishType = (value: string | undefined): value is PublishType => {
  return value === "free" || value === "subscribers" || value === "ppv";
};

export default function PublishSuccessPage({ searchParams }: PublishSuccessPageProps) {
  const typeParam = typeof searchParams.type === "string" ? searchParams.type : undefined;
  const priceParam = typeof searchParams.price === "string" ? searchParams.price : "0";

  const postType: PublishType = isPublishType(typeParam) ? typeParam : "subscribers";
  const price = priceParam || "0";

  return <PublishSuccessPageClient postType={postType} price={price} />;
}
