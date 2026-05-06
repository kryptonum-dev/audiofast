import { Box, Card, Spinner } from "@sanity/ui";

export function OrdersLoadingTable() {
  return (
    <Box paddingX={3}>
      <Card border radius={2}>
        <div className="ordersLoadingTableFrame">
          <Spinner muted />
        </div>
      </Card>
    </Box>
  );
}
