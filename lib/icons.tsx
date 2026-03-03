/**
 * GetFanSee Icon System — Coolicons
 * Drop-in replacement for lucide-react / phosphor imports.
 * Uses react-coolicons (https://github.com/krystonschwarze/coolicons).
 * Change import path from "lucide-react" to "@/lib/icons" to migrate.
 */
"use client";

import type React from "react";
import type { SVGProps } from "react";
import * as Ci from "react-coolicons";

/** Compat type alias for components that expected Lucide's icon component type */
export type LucideIcon = React.FC<{
  className?: string;
  size?: number | string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

const DEFAULT_SIZE = 24;

function wrap(Icon: React.FC<SVGProps<SVGSVGElement>>, opts?: { spin?: boolean }) {
  const C = ({ size, className, ...rest }: IconProps) => {
    const w = size ?? DEFAULT_SIZE;
    const h = size ?? DEFAULT_SIZE;
    const cn = [className, opts?.spin ? "animate-spin" : null].filter(Boolean).join(" ");
    return (
      <Icon
        width={typeof w === "number" ? w : undefined}
        height={typeof h === "number" ? h : undefined}
        className={cn || undefined}
        {...rest}
      />
    );
  };
  C.displayName = Icon.displayName ?? "Icon";
  return C;
}

// ── Navigation ──────────────────────────────────────────────────
export const Home = wrap(Ci.House01);
export const Search = wrap(Ci.SearchMagnifyingGlass);
export const SearchIcon = wrap(Ci.SearchMagnifyingGlass);
export const Compass = wrap(Ci.Compass);

// ── Chevrons / Carets ───────────────────────────────────────────
export const ChevronLeft = wrap(Ci.ChevronLeft);
export const ChevronLeftIcon = wrap(Ci.ChevronLeft);
export const ChevronRight = wrap(Ci.ChevronRight);
export const ChevronRightIcon = wrap(Ci.ChevronRight);
export const ChevronDown = wrap(Ci.ChevronDown);
export const ChevronDownIcon = wrap(Ci.ChevronDown);
export const ChevronUp = wrap(Ci.ChevronUp);
export const ChevronUpIcon = wrap(Ci.ChevronUp);

// ── Arrows ──────────────────────────────────────────────────────
export const ArrowLeft = wrap(Ci.ArrowLeftSm);
export const ArrowRight = wrap(Ci.ArrowRightSm);
export const ArrowUp = wrap(Ci.ArrowUpSm);
export const ArrowDown = wrap(Ci.ArrowDownSm);
export const ArrowUpRight = wrap(Ci.ArrowUpRightSm);

// ── Social / Interaction ─────────────────────────────────────────
export const Heart = wrap(Ci.Heart01);
export const Bell = wrap(Ci.Bell);
export const Star = wrap(Ci.Star);
export const Share2 = wrap(Ci.ShareAndroid);
export const MessageCircle = wrap(Ci.ChatCircle);
export const MessageSquare = wrap(Ci.Chat);
export const Flame = wrap(Ci.Sun);
export const Sparkles = wrap(Ci.Bulb);

// ── User / Auth ──────────────────────────────────────────────────
export const User = wrap(Ci.User01);
export const Users = wrap(Ci.Users);
export const UserCheck = wrap(Ci.UserCheck);
export const UserPlus = wrap(Ci.UserAdd);
export const LogOut = wrap(Ci.LogOut);
export const Eye = wrap(Ci.Show);
export const EyeOff = wrap(Ci.Hide);
export const Camera = wrap(Ci.Camera);

// ── Lock / Security ──────────────────────────────────────────────
export const Lock = wrap(Ci.Lock);
export const Unlock = wrap(Ci.LockOpen);
export const Shield = wrap(Ci.Shield);
export const ShieldAlert = wrap(Ci.ShieldWarning);

// ── Status / Feedback ────────────────────────────────────────────
export const AlertCircle = wrap(Ci.CircleWarning);
export const AlertTriangle = wrap(Ci.TriangleWarning);
export const CheckCircle = wrap(Ci.CircleCheck);
export const CheckCircle2 = wrap(Ci.CircleCheck);
export const CheckCheck = wrap(Ci.CheckAllBig);
export const Check = wrap(Ci.Check);
export const CheckIcon = wrap(Ci.Check);
export const X = wrap(Ci.CloseMd);
export const XIcon = wrap(Ci.CloseMd);
export const XCircle = wrap(Ci.CloseCircle);
export const CircleIcon = wrap(Ci.Loading, { spin: true });
export const Loader2 = wrap(Ci.Loading, { spin: true });
export const Loader2Icon = wrap(Ci.Loading, { spin: true });
export const RefreshCw = wrap(Ci.ArrowsReload01);
export const Info = wrap(Ci.Info);

// ── Settings / Controls ─────────────────────────────────────────
export const Settings = wrap(Ci.Settings);
export const Plus = wrap(Ci.AddPlus);
export const Minus = wrap(Ci.RemoveMinus);
export const MinusIcon = wrap(Ci.RemoveMinus);
export const MoreHorizontal = wrap(Ci.MoreHorizontal);
export const MoreHorizontalIcon = wrap(Ci.MoreHorizontal);
export const MoreVertical = wrap(Ci.MoreVertical);
export const PanelLeftIcon = wrap(Ci.WindowSidebar);
export const GripVerticalIcon = wrap(Ci.DragVertical);
export const Save = wrap(Ci.Save);
export const LayoutDashboard = wrap(Ci.MoreGridBig);
export const HelpCircle = wrap(Ci.Help);

// ── Content / Media ──────────────────────────────────────────────
export const FileText = wrap(Ci.FileDocument);
export const Image = wrap(Ci.Image01);
export const ImageIcon = wrap(Ci.Image01);
export const Video = wrap(Ci.Play);
export const Upload = wrap(Ci.FileUpload);
export const Download = wrap(Ci.Download);
export const Copy = wrap(Ci.Copy);
export const Edit = wrap(Ci.EditPencil01);
export const Edit3 = wrap(Ci.EditPencil01);
export const Trash2 = wrap(Ci.TrashFull);
export const Hash = wrap(Ci.Tag);
export const Tag = wrap(Ci.Tag);
export const Flag = wrap(Ci.Flag);
export const Globe = wrap(Ci.Globe);
export const Send = wrap(Ci.PaperPlane);
export const Mail = wrap(Ci.Mail);

// ── Finance (coolicons 无独立 DollarSign/Wallet/Coins，用相近图标) ──
export const DollarSign = wrap(Ci.CreditCard01);
export const Wallet = wrap(Ci.CreditCard01);
export const CreditCard = wrap(Ci.CreditCard01);
export const Coins = wrap(Ci.Gift);
export const ShoppingBag = wrap(Ci.Handbag);
export const Gift = wrap(Ci.Gift);
export const TrendingUp = wrap(Ci.TrendingUp);
export const TrendingDown = wrap(Ci.TrendingDown);
export const BarChart3 = wrap(Ci.ChartBarVertical01);

// ── Date / Time ───────────────────────────────────────────────────
export const Calendar = wrap(Ci.Calendar);
export const Clock = wrap(Ci.Clock);

// ── Layout / View ─────────────────────────────────────────────────
export const Grid3X3 = wrap(Ci.MoreGridBig);
export const List = wrap(Ci.ListUnordered);
export const Rows3 = wrap(Ci.Rows);
