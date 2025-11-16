import { Container, Heading, Table, Button, Badge, Switch, Text, Spinner } from "@chakra-ui/react";
import type { User } from "../../../api/src/db/schema";
import { useEffect, useState } from "react";
import { getUserWatchlist, removeFromUserWatchlist, toggledNotifications, type WatchlistItem } from "@/api/user_api";

type WatchlistProps = {
  user: User | null;
};

// dummmy data
// const placeholderWatchlist = [
//   { symbol: "AAPL", type: "Stock", notificationEnabled: false },
//   { symbol: "BTC", type: "Crypto", notificationEnabled: true },
// ];

// TODO: isLoading? slow to respond at times the pages
// TODO: maintain state between pages for UI

export default function Watchlist({ user }: WatchlistProps) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tickerNotiLoading, setTickerNotiLoading] = useState<number | null>(null);


  useEffect(() => {
    async function loadUserWatchlist() {
      try {
        const data = await getUserWatchlist();
        setWatchlist(data);
      } catch (err) {
        console.error("Unable to load watchlist", err);
      } finally {
        setLoading(false);
      }
    }
    loadUserWatchlist();
  }, []);

async function handleToggle(ticker: WatchlistItem) {
  setTickerNotiLoading(ticker.tickerId)
  // optimistic uiappraocj
  setWatchlist(prev =>
    prev.map(w =>
      w.tickerId === ticker.tickerId ? { ...w, notificationEnabled: !w.notificationEnabled } : w
    )
  );

  try {
    // backendcall
    await toggledNotifications(ticker.symbol, !ticker.notificationEnabled, ticker.type);
  } catch (err) {
    // if api fails, revert
    console.error("Toggle failed:", err);
    setWatchlist(prev =>
      prev.map(w =>
        w.tickerId === ticker.tickerId
          ? { ...w, notificationEnabled: ticker.notificationEnabled }
          : w
      )
    );
  }
   finally{
      setTickerNotiLoading(null); //  wehn done, enable button again for toggling alerts/notis
    }
}


  async function handleRemove(symbol: string) {
    try {
      await removeFromUserWatchlist(symbol);
      setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));
    } catch (err) {
      console.error("Remove failed:", err);
    }
  }

  if (loading)
    return (
      <Container paddingY={8}>
        <Spinner />
      </Container>
    );

  return (
    <Container paddingY={8}>
      <Heading mb={6}>{user?.email}'s Watchlist</Heading>

      {watchlist.length === 0 ? (
        <Text>No watchlist items yet.</Text>
      ):(
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              <Table.ColumnHeader>Ticker</Table.ColumnHeader>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader>Alerts</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {watchlist.map((ticker) => (
              <Table.Row key={ticker.tickerId}>
                <Table.Cell>{ticker.symbol}</Table.Cell>

                <Table.Cell>
                  <Badge>{ticker.type}</Badge>
                </Table.Cell>

                <Table.Cell>
                  <Switch.Root
                    checked={ticker.notificationEnabled ?? true}
                    onCheckedChange={() => handleToggle(ticker)}
                    opacity={tickerNotiLoading === ticker.tickerId ? 0.6 : 1} // only dim the one being toggled
                    disabled={tickerNotiLoading === ticker.tickerId} //Prevent double-clicks
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </Table.Cell>

                <Table.Cell textAlign="end">
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => handleRemove(ticker.symbol)}
                  >
                    Remove
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
    </Container>
  );
}