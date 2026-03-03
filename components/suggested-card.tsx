import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface SuggestedCardProps {
  name: string;
  handle: string;
  avatarUrl?: string;
}

export function SuggestedCard({ name, handle, avatarUrl }: SuggestedCardProps) {
  return (
    <div className="card-block p-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback className="bg-brand-primary/20 text-brand-primary">
            {name[0]?.toUpperCase() || "C"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{name}</p>
          <p className="truncate text-xs text-text-tertiary">@{handle}</p>
        </div>
        <Button variant="outline" size="sm">
          Follow
        </Button>
      </div>
    </div>
  );
}
