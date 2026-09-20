"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertUrgentRegular,
  BuildingRegular,
  CalendarLtrRegular,
  CheckmarkCircleRegular,
  PeopleRegular,
  PersonAccountsRegular,
} from "@fluentui/react-icons";

const links = [
  { href: "/", label: "Needs Attention", icon: AlertUrgentRegular },
  { href: "/timesheets", label: "Timesheets", icon: CalendarLtrRegular },
  { href: "/workers", label: "Workers", icon: PeopleRegular },
  { href: "/clients", label: "Clients", icon: BuildingRegular },
] as const;

const adminLinks = [
  { href: "/admin/users", label: "Staff accounts", icon: PersonAccountsRegular },
  { href: "/admin/resolved", label: "Resolved items", icon: CheckmarkCircleRegular },
] as const;

function isActive(href: string, pathname: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const items = admin ? [...links, ...adminLinks] : [...links];

  return (
    <nav className="flex flex-1 flex-col gap-0.5" aria-label="Primary">
      {items.map((link) => {
        const Icon = link.icon;
        const active = isActive(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
            className="ui-nav"
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
