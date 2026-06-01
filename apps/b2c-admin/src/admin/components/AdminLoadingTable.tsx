import { Box, Card, Spinner } from "@sanity/ui";

export function AdminLoadingTable() {
  return (
    <Box paddingX={3}>
      <Card border radius={2}>
        <div className="adminLoadingTableFrame">
          <Spinner muted />
        </div>
      </Card>
    </Box>
  );
}
