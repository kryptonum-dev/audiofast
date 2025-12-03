"use client";

import { useEffect } from "react";

import { trackEvent } from "@/global/analytics/track-event";

export default function Analytics() {
  useEffect(() => {
    const sendPageView = () => {
      const { location, document } = window;
      const pathname = location?.pathname ?? "";
      const search = location?.search ?? "";
      const url = location?.href ?? `${pathname}${search}`;
      const title = document?.title ?? undefined;

      trackEvent({
        meta: {
          eventName: "PageView",
          params: {
            page_path: `${pathname}${search}` || undefined,
          },
        },
        ga4: {
          eventName: "page_view",
          params: {
            page_location: url,
            page_path: pathname,
            ...(title ? { page_title: title } : {}),
          },
        },
      });
    };

    if (!window.__pageViewTracked) {
      sendPageView();
      window.__pageViewTracked = true;
    }

    const handleContactClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      const link = target.closest(
        'a[href^="mailto:"], a[href^="tel:"]',
      ) as HTMLAnchorElement | null;
      if (!link) return;

      const href = link.getAttribute("href") ?? "";
      const contactType = href.startsWith("mailto:") ? "email" : "phone";

      trackEvent({
        meta: {
          eventName: "Contact",
          params: {
            contact_type: contactType,
            contact_value: href,
          },
        },
        ga4: {
          eventName: "contact",
          params: {
            contact_type: contactType,
            contact_value: href,
          },
        },
      });
    };

    document.addEventListener("click", handleContactClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleContactClick, {
        capture: true,
      });
    };
  }, []);

  return null;
}
