export type AdminRoute =
  | {
      screen: "orders";
    }
  | {
      orderNumber: string;
      screen: "orderDetail";
    };

const ORDERS_PATH = "/orders";

export function parseAdminRoute(pathname = window.location.pathname): AdminRoute {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "orders" && parts[1]) {
    return {
      orderNumber: decodeURIComponent(parts[1]),
      screen: "orderDetail",
    };
  }

  return {
    screen: "orders",
  };
}

export function getOrdersPath() {
  return ORDERS_PATH;
}

export function getOrderDetailPath(orderNumber: string) {
  return `${ORDERS_PATH}/${encodeURIComponent(orderNumber)}`;
}
