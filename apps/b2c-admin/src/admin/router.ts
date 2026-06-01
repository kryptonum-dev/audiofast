export type AdminRoute =
  | {
      screen: "orders";
    }
  | {
      screen: "analytics";
    }
  | {
      screen: "coupons";
    }
  | {
      screen: "couponCreate";
    }
  | {
      couponId: string;
      screen: "couponEdit";
    }
  | {
      orderNumber: string;
      screen: "orderDetail";
    };

const ORDERS_PATH = "/orders";
const COUPONS_PATH = "/coupons";
const ANALYTICS_PATH = "/analytics";

export function parseAdminRoute(
  pathname = window.location.pathname,
): AdminRoute {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "orders" && parts[1]) {
    return {
      orderNumber: decodeURIComponent(parts[1]),
      screen: "orderDetail",
    };
  }

  if (parts[0] === "coupons") {
    if (parts[1] === "new") {
      return {
        screen: "couponCreate",
      };
    }

    if (parts[1]) {
      return {
        couponId: decodeURIComponent(parts[1]),
        screen: "couponEdit",
      };
    }

    return {
      screen: "coupons",
    };
  }

  if (parts[0] === "analytics") {
    return {
      screen: "analytics",
    };
  }

  return {
    screen: "orders",
  };
}

export function getOrdersPath() {
  return ORDERS_PATH;
}

export function getCouponsPath() {
  return COUPONS_PATH;
}

export function getAnalyticsPath() {
  return ANALYTICS_PATH;
}

export function getCouponCreatePath() {
  return `${COUPONS_PATH}/new`;
}

export function getCouponEditPath(couponId: string) {
  return `${COUPONS_PATH}/${encodeURIComponent(couponId)}`;
}

export function getOrderDetailPath(orderNumber: string) {
  return `${ORDERS_PATH}/${encodeURIComponent(orderNumber)}`;
}
