"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { QueryNavbarResult } from "@/global/sanity/sanity.types";

import styles from "./styles.module.scss";

type HeaderLinksProps = {
  buttons: NonNullable<QueryNavbarResult>["buttons"];
};

export default function HeaderLinks({ buttons }: HeaderLinksProps) {
  const pathname = usePathname();

  return (
    <>
      {buttons?.map((button) => {
        const href = button.href || "";
        const isActive =
          href === "/"
            ? pathname === "/"
            : pathname?.startsWith(href) && href !== "";
        return (
          <Link
            key={button._key}
            href={href}
            className={`${styles.navLink} ${isActive ? styles.active : ""}`}
            {...(button.openInNewTab && {
              target: "_blank",
              rel: "noreferrer",
            })}
          >
            {button.text}
          </Link>
        );
      })}
    </>
  );
}
