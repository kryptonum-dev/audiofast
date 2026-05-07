import { useEffect, useState } from "react";

import {
  getCouponCreatePath,
  getCouponEditPath,
  getCouponsPath,
  getOrderDetailPath,
  getOrdersPath,
  parseAdminRoute,
  type AdminRoute,
} from "./router.js";
import { AdminShell } from "./components/AdminShell.js";
import { CouponCreateView } from "./components/CouponCreateView.js";
import { CouponEditView } from "./components/CouponEditView.js";
import { CouponsListing } from "./components/CouponsListing.js";
import { OrderDetailView } from "./components/OrderDetailView.js";
import { OrdersListing } from "./components/OrdersListing.js";
import type { AdminArea } from "./types.js";

export function AdminApp() {
  const [route, setRoute] = useState<AdminRoute>(() => parseAdminRoute());

  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState(null, "", getOrdersPath());
      setRoute(parseAdminRoute());
    }

    function handlePopState() {
      setRoute(parseAdminRoute());
    }

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(path: string) {
    window.history.pushState(null, "", path);
    setRoute(parseAdminRoute(path));
  }

  function navigateArea(area: AdminArea) {
    if (area === "coupons") {
      navigate(getCouponsPath());
      return;
    }

    if (area === "orders") {
      navigate(getOrdersPath());
    }
  }

  const activeArea =
    route.screen === "coupons" ||
    route.screen === "couponCreate" ||
    route.screen === "couponEdit"
      ? "coupons"
      : "orders";

  return (
    <AdminShell activeArea={activeArea} onAreaChange={navigateArea}>
      {route.screen === "couponCreate" ? (
        <CouponCreateView onBack={() => navigate(getCouponsPath())} />
      ) : route.screen === "couponEdit" ? (
        <CouponEditView
          couponId={route.couponId}
          onBack={() => navigate(getCouponsPath())}
        />
      ) : route.screen === "coupons" ? (
        <CouponsListing
          onCreateCoupon={() => navigate(getCouponCreatePath())}
          onOpenCoupon={(couponId) => navigate(getCouponEditPath(couponId))}
        />
      ) : route.screen === "orderDetail" ? (
        <OrderDetailView
          orderNumber={route.orderNumber}
          onBack={() => navigate(getOrdersPath())}
        />
      ) : (
        <OrdersListing
          onOpenOrder={(orderNumber) =>
            navigate(getOrderDetailPath(orderNumber))
          }
        />
      )}
    </AdminShell>
  );
}
