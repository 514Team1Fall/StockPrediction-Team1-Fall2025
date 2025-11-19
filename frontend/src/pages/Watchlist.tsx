import {
  Container,
  Heading,
  Table,
  Button,
  Badge,
  Switch,
  Text,
  Box,
} from "@chakra-ui/react";
import type { User } from "../../../api/src/db/schema";
import { useEffect, useState } from "react";
import {
  addToUserWatchlist,
  getUserWatchlist,
  removeFromUserWatchlist,
  toggledNotifications,
  type WatchlistItem,
} from "@/api/user_api";
import Loading from "./Loading";
import SearchBarTicker from "@/components/SearchBarTicker";

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
        // console.log("reloadig page after add or delete", data)
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
    return <Loading />;
  }

  async function handleAddTicker(symbol: string) {
    try {
      // console.log("symbol to be added: ", symbol);
      await addToUserWatchlist(symbol);

      const data = await getUserWatchlist();
      // data.forEach((item: Ticker) => console.log("Itemjsfiduuifisfiusufsdfuiudiudffs:", item.symbol, item));
      setWatchlist(data);
    } catch (err) {
      console.error("cant add ticker:", err);
    }
  }

  async function handleToggle(ticker: WatchlistItem) {
    if (loadingTickers.has(ticker.tickerId)) return; // don't mess with loading ticker

    setLoadingTickers((prev) => new Set(prev).add(ticker.tickerId));

    try {
      await toggledNotifications(
        ticker.symbol,
        !ticker.notificationEnabled,
        ticker.type
      ); //update in db
      const newNotiEnabled = !ticker.notificationEnabled;
      setWatchlist((prev) =>
        prev.map((w) =>
          w.tickerId === ticker.tickerId
            ? { ...w, notificationEnabled: newNotiEnabled } // extract selected ticker's props, set new notification value
            : w
        )
      );
    } catch (err) {
      console.error("toggle failed: ", err);
    } finally {
      setLoadingTickers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(ticker.tickerId);
        return newSet;
      }); //  wehn done, enable button again for toggling alerts/notis
    }
  }

  async function handleRemove(symbol: string) {
    try {
      await removeFromUserWatchlist(symbol);
      // console.log("Ticker removed successfully");
      setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));
    } catch (err) {
      console.error("Remove failed:", err);
    }
  }

  return (
    <Container paddingY={8}>
      <Heading mb={6}>{user?.email}'s Watchlist</Heading>
      <Box mb={6}>
        <SearchBarTicker
          onSelect={handleAddTicker}
          watchlistSymbols={watchlist.map((t) => t.symbol)}
        />
      </Box>
      {watchlist.length === 0 ? (
        <Text>
          No tickers added to watchlist yet. Search and add tickers above!
        </Text>
      ) : (
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
