import { AdminShell } from "./components/AdminShell.js";
import { OrdersListing } from "./components/OrdersListing.js";

export function AdminApp() {
  return (
    <AdminShell activeArea="orders">
      <OrdersListing />
    </AdminShell>
  );
}
