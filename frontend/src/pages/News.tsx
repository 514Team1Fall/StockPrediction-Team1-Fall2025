import { getNewsArticles, type NewsArticleTickers } from "@/api/article_api";
import { Link as ReactLink } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Container,
  Flex,
  Heading,
  IconButton,
  Link,
  Pagination,
  Table,
  Text,
} from "@chakra-ui/react";
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronLeft,
  LuChevronRight,
  LuExternalLink,
} from "react-icons/lu";
import Loading from "./Loading";

export default function News() {
  const [articles, setArticles] = useState<NewsArticleTickers[]>([]);
  const [isloading, setLoading] = useState<boolean>(true);
  const [watchlistOnly, setWatchlistOnly] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc"); // sortby newest by default
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    async function loadArticles() {
      try {
        setLoading(true); // make website preload data before loading page
        const data = await getNewsArticles(watchlistOnly);
        // console.log("articles loading...", data);
        setArticles(data);
      } catch (err) {
        console.error("Unable to load  articles", err);
      } finally {
        setLoading(false);
      }
    }
    loadArticles();
  }, []);

  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => {
      // if either dates are null shove them to the backo f the LINE
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;

      // is o converter
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
  }, [articles, sortOrder]);

  const paginatedArticles = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sortedArticles.slice(start, end);
  }, [sortedArticles, page, pageSize]);

  if (isloading) {
    return <Loading />;
  }

  function toggleSort() {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    setPage(1);
  }

  function formatDate(articleDatePublished: string | Date | null) {
    if (!articleDatePublished) return "no date";
    const date = new Date(articleDatePublished);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <Container paddingY={8}>
      <Heading marginBottom={6}>News Articles</Heading>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={6}>
            <Heading>News Articles</Heading>
            <Button
                onClick={() => setWatchlistOnly((prev) => !prev)}
                colorPalette={watchlistOnly ? "blue" : "gray"}
                variant="solid"
            >
                {watchlistOnly ? "Show All" : "Watchlist Only"}
            </Button>
        </Flex>
      <Box boxShadow="sm">
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              <Table.ColumnHeader htmlWidth="60%">Title</Table.ColumnHeader>
              <Table.ColumnHeader
                onClick={toggleSort}
                cursor="pointer"
                _hover={{ bg: "gray.100" }}
                htmlWidth="14%"
              >
                <Flex alignItems="center" gap={1}>
                  Published
                  {sortOrder === "desc" ? <LuArrowDown /> : <LuArrowUp />}
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader htmlWidth="15%">Tickers</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end" htmlWidth="11%">
                Article Insights
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {paginatedArticles.map((article) => (
              <Table.Row key={article.articleId}>
                <Table.Cell>
                  <Link colorPalette="blue" href={article.url}>
                    {article.title} <LuExternalLink />
                  </Link>
                </Table.Cell>

                <Table.Cell>
                  <Text fontSize="sm" color="gray.600">
                    {formatDate(article.publishedAt)}
                  </Text>
                </Table.Cell>

                <Table.Cell>
                  <Flex gap={1} flexWrap="wrap">
                    {article.tickers.map((ticker) => (
                      <Badge key={ticker.tickerId}>{ticker.symbol}</Badge>
                    ))}
                  </Flex>
                </Table.Cell>
                <Table.Cell textAlign="end">
                  <Button colorPalette="gray" variant="subtle" asChild>
                    <ReactLink
                      to={`/news/${article.articleId}`}
                      state={{ article }}
                    >
                      View Insights
                    </ReactLink>
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      <Pagination.Root
        count={sortedArticles.length}
        pageSize={pageSize}
        page={page}
        onPageChange={(e) => setPage(e.page)}
      >
        <Flex justifyContent="center" gap={2} mt={4}>
          <ButtonGroup variant="outline" size="sm">
            <Pagination.PrevTrigger asChild>
              <IconButton variant="ghost" size="sm">
                <LuChevronLeft />
              </IconButton>
            </Pagination.PrevTrigger>
            <Pagination.Items
              render={(page) => (
                <IconButton variant={{ base: "outline", _selected: "solid" }}>
                  {page.value}
                </IconButton>
              )}
            />
            <Pagination.NextTrigger asChild>
              <IconButton variant="ghost" size="sm">
                <LuChevronRight />
              </IconButton>
            </Pagination.NextTrigger>
          </ButtonGroup>
        </Flex>
      </Pagination.Root>
    </Container>
  );
}
