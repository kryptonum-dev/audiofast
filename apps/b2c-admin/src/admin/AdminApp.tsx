import { useEffect, useState } from "react";

import {
  getOrderDetailPath,
  getOrdersPath,
  parseAdminRoute,
  type AdminRoute,
} from "./router.js";
import { AdminShell } from "./components/AdminShell.js";
import { OrderDetailView } from "./components/OrderDetailView.js";
import { OrdersListing } from "./components/OrdersListing.js";

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

  return (
    <AdminShell activeArea="orders">
      {route.screen === "orderDetail" ? (
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
