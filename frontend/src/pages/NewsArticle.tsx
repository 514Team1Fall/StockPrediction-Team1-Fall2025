import {
  Avatar,
  Card,
  Container,
  Heading,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  getTickersFromArticleId,
  type ArticleTickers,
} from "@/api/article_api";
import { useEffect, useState } from "react";
import { LuStar } from "react-icons/lu";
import { FaStar } from "react-icons/fa";
import { useParams, useLocation } from "react-router-dom";
import {
  addToUserWatchlist,
  getUserWatchlist,
  removeFromUserWatchlist,
  type WatchlistItem,
} from "@/api/user_api";
import Loading from "./Loading";

// aericle summary/title is scuffed... do this always: news page --> "view insights" --> boom get summary/title | too lazy for other method
// fetchArticleById() if it exists to filter by article id?

export default function NewsArticle(/*user: NewsArticleProps*/) {
  const [addedTickers, setAddedTickers] = useState<Set<number>>(new Set()); // tickerid tracker
  const [tickers, setTickers] = useState<ArticleTickers[]>([]);
  const [loadingTickers, setLoadingTickers] = useState<Set<number>>(new Set());
  const [isLoading, setLoading] = useState<boolean>(true);
  const { articleId } = useParams<{ articleId: string }>(); // Extracts 'id' from a route like /users/:id
  const location = useLocation();
  const article = location.state?.article;
  console.log("article id:", articleId);

  useEffect(() => {
    async function loadTickersFromArticle() {
      try {
        if (articleId) {
          setLoading(true);
          const data = await getTickersFromArticleId(articleId);
          console.log("articles loading...", data);
          setTickers(data || []);

          // load user watchlist to see what's already added
          const watchlist = await getUserWatchlist();
          const watchlistTickerIds = new Set<number>(
            watchlist.map((w: WatchlistItem) => w.tickerId)
          );
          setAddedTickers(watchlistTickerIds);
        }
      } catch (err) {
        console.error("issue retreiving tickers from article: ", err);
      } finally {
        setLoading(false);
      }
    }
    loadTickersFromArticle();
  }, [articleId]);

  if (isLoading) {
    return <Loading></Loading>;
  }

  /**
   * Toggles addition/ removal of a ticker from a watchlist from NewsArticle page
   * Makes sure spam clicking star button isn't an issue with loadingTickers
   */
  async function tickerToggle(tickerId: number) {
    try {
      const ticker = tickers.find((t) => t.tickerId === tickerId); // checkeing if ticker exist from article
      if (!ticker) return;

      //prevent double clicks
      if (loadingTickers.has(tickerId)) return;

      // specific ticker is now loading --> don't want to make all tickers loading
      setLoadingTickers((prev) => new Set(prev).add(tickerId));

      const isCurrentlyAdded = addedTickers.has(tickerId); // checking if ticker added to watchlist

      if (isCurrentlyAdded) {
        await removeFromUserWatchlist(ticker.symbol);
      } else {
        await addToUserWatchlist(ticker.symbol);
      }
      // console.log("is currently added ticker?: ", isCurrentlyAdded)

      setAddedTickers((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(tickerId)) {
          newSet.delete(tickerId);
        } else {
          newSet.add(tickerId);
        }
        return newSet;
      });
    } catch (err) {
      console.error("issue adding ticker to watchlist: ", err);
    } finally {
      // no matter what remove loading state at the end so not all buttons are unclickable (used in button disabled property below)
      setLoadingTickers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(tickerId);
        return newSet;
      });
    }
  }

  return (
    <Container paddingY={8}>
      <Stack gap={4} mb={8}>
        <Heading size="xl">
          {article?.title
            ? `Article Title: ${article.title}`
            : `No title available`}
        </Heading>
        <Text textStyle="lg" color="gray.600">
          {article?.summary
            ? `Article Summary: ${article.summary}`
            : `No summary available`}
        </Text>
      </Stack>

      <Stack gap="4" direction="row" wrap="wrap">
        {tickers.map((ticker) => {
          const isAdded = addedTickers.has(ticker.tickerId); // Check if this specific ticker is added
          return (
            <Card.Root key={ticker.tickerId} width="320px" variant="elevated">
              <Card.Body gap="2">
                <Avatar.Root size="lg" shape="rounded">
                  <Avatar.Fallback name={ticker.symbol} />
                </Avatar.Root>
                <Card.Title mb="2">{ticker.symbol} Sentiments</Card.Title>
                <Card.Description>
                  <strong>Sentiment:</strong>{" "}
                  {ticker.tickerSentimentLabel || "N/A"}
                </Card.Description>
                <Card.Description>
                  <strong>Score:</strong> {ticker.tickerSentimentScore || "N/A"}
                </Card.Description>
                {/* <strong>Relevance:</strong> {ticker.relevanceScore || "N/A"} */}
              </Card.Body>
              <Card.Footer justifyContent="flex-end">
                <IconButton
                  aria-label="add to watchlist"
                  // variant="subtle"
                  onClick={() => tickerToggle(ticker.tickerId)}
                  disabled={loadingTickers.has(ticker.tickerId)} // disable button while loading to not double click
                  loading={loadingTickers.has(ticker.tickerId)} //
                  color={isAdded ? "yellow" : "white"}
                >
                  {isAdded ? <FaStar /> : <LuStar />}
                </IconButton>
              </Card.Footer>
            </Card.Root>
          );
        })}
      </Stack>
    </Container>
  );
}
