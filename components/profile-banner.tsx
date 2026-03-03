import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProfileBannerProps {
  name: string;
  email: string;
  role: "fan" | "creator";
  avatarUrl?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ProfileBanner({
  name,
  email,
  role,
  avatarUrl,
  action,
  className,
}: ProfileBannerProps) {
  return (
    <div className={cn("glass-card rounded-[var(--radius-md)] p-4 md:p-5", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-16 ring-2 ring-white/10">
            <AvatarImage src={avatarUrl} alt={`${name} avatar`} />
            <AvatarFallback className="text-[18px] font-bold">
              {name?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-[18px] font-semibold text-white">{name}</h1>
            <p className="text-[12px] text-text-muted">{email}</p>
            <Badge variant={role === "creator" ? "rose" : "default"} className="mt-1.5 text-[10px]">
              {role === "creator" ? "Creator" : "Fan"}
            </Badge>
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
