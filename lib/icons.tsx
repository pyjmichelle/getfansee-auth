/**
 * GetFanSee Icon System — Phosphor Duotone
 * Drop-in replacement for lucide-react imports.
 * Change import path from "lucide-react" to "@/lib/icons" to migrate.
 *
 * Default weight: "duotone" — rich two-tone depth matching Liquid Glass design.
 */
"use client";

import type React from "react";
import type { ComponentPropsWithoutRef } from "react";
import type { Icon, IconWeight } from "@phosphor-icons/react";

/** Compat type alias for components that expected Lucide's icon component type */
export type LucideIcon = React.FC<{
  className?: string;
  size?: number | string;
  "aria-hidden"?: boolean | "true" | "false";
}>;
import {
  House as PhHouse,
  MagnifyingGlass as PhMagnifyingGlass,
  Heart as PhHeart,
  Bell as PhBell,
  User as PhUser,
  Users as PhUsers,
  UserCheck as PhUserCheck,
  UserPlus as PhUserPlus,
  Lock as PhLock,
  LockOpen as PhLockOpen,
  Eye as PhEye,
  EyeSlash as PhEyeSlash,
  Gear as PhGear,
  SignOut as PhSignOut,
  Envelope as PhEnvelope,
  WarningCircle as PhWarningCircle,
  Warning as PhWarning,
  CircleNotch as PhCircleNotch,
  CheckCircle as PhCheckCircle,
  ShareNetwork as PhShareNetwork,
  ChatCircle as PhChatCircle,
  CurrencyDollar as PhCurrencyDollar,
  Fire as PhFire,
  Sparkle as PhSparkle,
  PencilSimple as PhPencilSimple,
  Trash as PhTrash,
  FileText as PhFileText,
  Camera as PhCamera,
  PaperPlaneTilt as PhPaperPlaneTilt,
  SquaresFour as PhSquaresFour,
  DotsThree as PhDotsThree,
  DotsThreeVertical as PhDotsThreeVertical,
  ArrowsClockwise as PhArrowsClockwise,
  TrendUp as PhTrendUp,
  TrendDown as PhTrendDown,
  ChartBar as PhChartBar,
  GridFour as PhGridFour,
  Rows as PhRows,
  Question as PhQuestion,
  Compass as PhCompass,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  CaretDown as PhCaretDown,
  CaretUp as PhCaretUp,
  SidebarSimple as PhSidebarSimple,
  DotsSixVertical as PhDotsSixVertical,
  FloppyDisk as PhFloppyDisk,
  VideoCamera as PhVideoCamera,
  Plus as PhPlus,
  Minus as PhMinus,
  X as PhX,
  Check as PhCheck,
  Star as PhStar,
  Flag as PhFlag,
  Globe as PhGlobe,
  Tag as PhTag,
  Hash as PhHash,
  Calendar as PhCalendar,
  Clock as PhClock,
  Shield as PhShield,
  ShieldWarning as PhShieldWarning,
  Upload as PhUpload,
  Download as PhDownload,
  Copy as PhCopy,
  Image as PhImage,
  Info as PhInfo,
  CreditCard as PhCreditCard,
  Wallet as PhWallet,
  Gift as PhGift,
  Coins as PhCoins,
  ShoppingBag as PhShoppingBag,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowUp as PhArrowUp,
  ArrowDown as PhArrowDown,
  ArrowUpRight as PhArrowUpRight,
  ChatText as PhChatText,
  XCircle as PhXCircle,
  CheckSquare as PhCheckSquare,
  List as PhList,
} from "@phosphor-icons/react";

type IconProps = ComponentPropsWithoutRef<Icon> & { weight?: IconWeight };

/** Returns a component that defaults to duotone weight */
function d(PhIcon: Icon) {
  const C = ({ weight = "duotone", ...rest }: IconProps) => <PhIcon weight={weight} {...rest} />;
  C.displayName = PhIcon.displayName;
  return C;
}

// ── Navigation ──────────────────────────────────────────────────
export const Home = d(PhHouse);
export const Search = d(PhMagnifyingGlass);
export const SearchIcon = d(PhMagnifyingGlass);
export const Compass = d(PhCompass);

// ── Chevrons / Carets ───────────────────────────────────────────
export const ChevronLeft = d(PhCaretLeft);
export const ChevronLeftIcon = d(PhCaretLeft);
export const ChevronRight = d(PhCaretRight);
export const ChevronRightIcon = d(PhCaretRight);
export const ChevronDown = d(PhCaretDown);
export const ChevronDownIcon = d(PhCaretDown);
export const ChevronUp = d(PhCaretUp);
export const ChevronUpIcon = d(PhCaretUp);

// ── Arrows ──────────────────────────────────────────────────────
export const ArrowLeft = d(PhArrowLeft);
export const ArrowRight = d(PhArrowRight);
export const ArrowUp = d(PhArrowUp);
export const ArrowDown = d(PhArrowDown);
export const ArrowUpRight = d(PhArrowUpRight);

// ── Social / Interaction ─────────────────────────────────────────
export const Heart = d(PhHeart);
export const Bell = d(PhBell);
export const Star = d(PhStar);
export const Share2 = d(PhShareNetwork);
export const MessageCircle = d(PhChatCircle);
export const MessageSquare = d(PhChatText);
export const Flame = d(PhFire);
export const Sparkles = d(PhSparkle);

// ── User / Auth ──────────────────────────────────────────────────
export const User = d(PhUser);
export const Users = d(PhUsers);
export const UserCheck = d(PhUserCheck);
export const UserPlus = d(PhUserPlus);
export const LogOut = d(PhSignOut);
export const Eye = d(PhEye);
export const EyeOff = d(PhEyeSlash);
export const Camera = d(PhCamera);

// ── Lock / Security ──────────────────────────────────────────────
export const Lock = d(PhLock);
export const Unlock = d(PhLockOpen);
export const Shield = d(PhShield);
export const ShieldAlert = d(PhShieldWarning);

// ── Status / Feedback ────────────────────────────────────────────
export const AlertCircle = d(PhWarningCircle);
export const AlertTriangle = d(PhWarning);
export const CheckCircle = d(PhCheckCircle);
export const CheckCircle2 = d(PhCheckCircle);
export const CheckCheck = d(PhCheckSquare);
export const Check = d(PhCheck);
export const CheckIcon = d(PhCheck);
export const X = d(PhX);
export const XIcon = d(PhX);
export const XCircle = d(PhXCircle);
export const CircleIcon = d(PhCircleNotch);
export const Loader2 = d(PhCircleNotch);
export const Loader2Icon = d(PhCircleNotch);
export const RefreshCw = d(PhArrowsClockwise);
export const Info = d(PhInfo);

// ── Settings / Controls ──────────────────────────────────────────
export const Settings = d(PhGear);
export const Plus = d(PhPlus);
export const Minus = d(PhMinus);
export const MinusIcon = d(PhMinus);
export const MoreHorizontal = d(PhDotsThree);
export const MoreHorizontalIcon = d(PhDotsThree);
export const MoreVertical = d(PhDotsThreeVertical);
export const PanelLeftIcon = d(PhSidebarSimple);
export const GripVerticalIcon = d(PhDotsSixVertical);
export const Save = d(PhFloppyDisk);
export const LayoutDashboard = d(PhSquaresFour);
export const HelpCircle = d(PhQuestion);

// ── Content / Media ──────────────────────────────────────────────
export const FileText = d(PhFileText);
export const Image = d(PhImage);
export const ImageIcon = d(PhImage);
export const Video = d(PhVideoCamera);
export const Upload = d(PhUpload);
export const Download = d(PhDownload);
export const Copy = d(PhCopy);
export const Edit = d(PhPencilSimple);
export const Edit3 = d(PhPencilSimple);
export const Trash2 = d(PhTrash);
export const Hash = d(PhHash);
export const Tag = d(PhTag);
export const Flag = d(PhFlag);
export const Globe = d(PhGlobe);
export const Send = d(PhPaperPlaneTilt);
export const Mail = d(PhEnvelope);

// ── Finance ───────────────────────────────────────────────────────
export const DollarSign = d(PhCurrencyDollar);
export const Wallet = d(PhWallet);
export const CreditCard = d(PhCreditCard);
export const Coins = d(PhCoins);
export const ShoppingBag = d(PhShoppingBag);
export const Gift = d(PhGift);
export const TrendingUp = d(PhTrendUp);
export const TrendingDown = d(PhTrendDown);
export const BarChart3 = d(PhChartBar);

// ── Date / Time ───────────────────────────────────────────────────
export const Calendar = d(PhCalendar);
export const Clock = d(PhClock);

// ── Layout / View ─────────────────────────────────────────────────
export const Grid3X3 = d(PhGridFour);
export const List = d(PhList);
export const Rows3 = d(PhRows);
