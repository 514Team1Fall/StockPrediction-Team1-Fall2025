import { Container, Heading, Table, Button, Badge, Switch, Text } from "@chakra-ui/react";
import type { User } from "../../../api/src/db/schema";
import { useEffect, useState } from "react";
import { getUserWatchlist, removeFromUserWatchlist, toggledNotifications, type WatchlistItem } from "@/api/user_api";
import Loading from "./Loading";

type WatchlistProps = {
  user: User | null;
};

// dummmy data
// const placeholderWatchlist = [
//   { symbol: "AAPL", type: "Stock", notificationEnabled: false },
//   { symbol: "BTC", type: "Crypto", notificationEnabled: true },
// ];

export default function Watchlist({ user }: WatchlistProps) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]); // content displayed in watchlist page
  const [isLoading, setLoading] = useState<boolean>(true);
  const [loadingTickers, setLoadingTickers] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function loadUserWatchlist() {
      try {
        setLoading(true);
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

  if (isLoading) {
    return <Loading/>
  }
 
  async function handleToggle(ticker: WatchlistItem) {
    if (loadingTickers.has(ticker.tickerId)) return; // don't mess with loading ticker

    setLoadingTickers(prev => new Set(prev).add(ticker.tickerId));

    try {
      await toggledNotifications(ticker.symbol, !ticker.notificationEnabled, ticker.type); //update in db
      const newNotiEnabled = !ticker.notificationEnabled
      setWatchlist(prev =>
        prev.map(w => w.tickerId === ticker.tickerId
          ? { ...w, notificationEnabled: newNotiEnabled } // extract selected ticker's props, set new notification value
          : w
        )
      );
    } catch (err) {
      console.error("toggle failed: ", err)
    }
    finally {
        setLoadingTickers(prev => {
          const newSet = new Set(prev);
          newSet.delete(ticker.tickerId);
          return newSet;
        }); //  wehn done, enable button again for toggling alerts/notis
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
                    checked={ticker.notificationEnabled}
                    onCheckedChange={() => handleToggle(ticker)}
                    disabled={loadingTickers.has(ticker.tickerId)} //Prevent double-clicks
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