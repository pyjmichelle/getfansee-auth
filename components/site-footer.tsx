import Link from "next/link";

const legalLinks = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund", label: "Refund Policy" },
  { href: "/dmca", label: "DMCA" },
  { href: "/2257", label: "18 U.S.C. § 2257" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/support", label: "Support" },
];

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-border-base bg-bg-base py-6 px-4">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
        <nav aria-label="Legal links" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-text-disabled text-center">
          © {new Date().getFullYear()} GetFanSee. All rights reserved. This site contains
          age-restricted content intended for adults 18+.
        </p>
      </div>
    </footer>
  );
}
