import VerifyPageClient from "./VerifyPageClient";

type VerifyPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

const pickParam = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export default function VerifyPage({ searchParams }: VerifyPageProps) {
  return (
    <VerifyPageClient
      query={{
        code: pickParam(searchParams.code),
        token: pickParam(searchParams.token),
        type: pickParam(searchParams.type),
        error: pickParam(searchParams.error),
        error_description: pickParam(searchParams.error_description),
        email: pickParam(searchParams.email),
      }}
    />
  );
}
