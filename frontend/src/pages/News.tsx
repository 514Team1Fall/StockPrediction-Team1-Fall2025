import { getNewsArticles, type NewsArticleTickers } from "@/api/article_api";
// import type { User } from "../../../src/db/schema";
// import type { NewsArticle } from "../../../src/db/schema.js";
import { Link as ReactLink } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Link,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { LuArrowDown, LuArrowUp, LuExternalLink } from "react-icons/lu";

// type NewsProps = {
//   user: User | null;
// };

export default function News(/*{ user }: NewsProps*/) {
  // const [isLoading, setIsLoading] = useState(true)
  const [articles, setArticles] = useState<NewsArticleTickers[]>([]);
  const [isloading , setLoading] = useState<boolean>(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // sortby newest by default


  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    setLoading(true); // make website preload data before loading page
    const data = await getNewsArticles();
    console.log("articles loading...", data);
    setArticles(data);
    setLoading(false); // done data loading
  }

  // while loading, show spiner
  if (isloading) {
    return (
      <Container paddingY={8}>
        <Heading marginBottom={6}>News Articles</Heading>
        <Flex justifyContent="center" paddingY={16}>
          <Spinner size="xl" />
        </Flex>
      </Container>
    );
  }

  const sortedArticles = [...articles].sort((a, b) => {
    // if either dates are null shove them to the backo f the LINE
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    
    // is o converter
    const dateA = new Date(a.publishedAt).getTime();
    const dateB = new Date(b.publishedAt).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  function toggleSort() {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  }

  function formatDate(articleDatePublished: string | Date | null) {
    if (!articleDatePublished) return "no date";
    const date = new Date(articleDatePublished);  // ✅ Convert string to Date
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"});
  }

  return (
    // default container padding-left/right is 32px so we match it with 8
    // doing stuff like paddingY{8} --> is value * 4px = actual px your using
    <Container paddingY={8}>
      <Heading marginBottom={6}>News Articles</Heading>

      <Box boxShadow="sm">
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              <Table.ColumnHeader>Title</Table.ColumnHeader>
              {/* ✅ Clickable Published column */}
              <Table.ColumnHeader 
                onClick={toggleSort}
                cursor="pointer"
                _hover={{ bg: "gray.100" }}
              >
                <Flex alignItems="center" gap={1}>
                  Published
                  {sortOrder === 'desc' ? <LuArrowDown /> : <LuArrowUp />}
                </Flex>
              </Table.ColumnHeader>
              <Table.ColumnHeader>Tickers</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">
                Article Insights
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {sortedArticles.map((article) => (
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
                  <Button colorPalette="gray" variant="subtle">
                    <ReactLink 
                      to={`/news/${article.articleId}`}
                      state = {{article}}
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
    </Container>
  );
}
