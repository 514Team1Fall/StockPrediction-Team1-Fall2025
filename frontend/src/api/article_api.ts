import { API_URL } from "@/assets/config";
import type { NewsArticle, NewsArticleTicker } from "../../../api/src/db/schema";

// const TICKER_API_ROUTE = '/api/tickers';
const ARTICLE_API_ROUTE = '/api/articles';
// const USER_API_ROUTE = '/api/users';
// const AUTH_API_ROUTE = '/api/auth';


export interface ArticleTickers extends NewsArticleTicker{ // tickers in a article + symbol property
    symbol: string
}
export interface NewsArticleTickers extends NewsArticle { //news
    tickers: ArticleTickers[];
}
// articleId, url, title, summary,publishedat, {tickers: {number: articleid, tickerid, tickersentimentscore, label, releavence, symbol}}
/**
 * Get all articles with their ticker sentiments
 * @returns 
 */
export async function getNewsArticles(): Promise<NewsArticleTickers[]> {
    const response = await fetch(`${API_URL}${ARTICLE_API_ROUTE}`, {
        credentials: "include",
    });

    if (!response.ok) throw new Error('failed to get articles');
    return response.json();
}

/**
 * Get sentiments for all tickers on an article
 */
// articleRouter.get("/:articleId/tickers", async (req: Request, res: Response) => {
export async function getTickersFromArticleId(articleId: string) {
    const response = await fetch(`${API_URL}${ARTICLE_API_ROUTE}/${articleId}/tickers`, {
        credentials: "include",
    });

    console.log(`get tickers from article frotnend...`, response)

    if (!response.ok) throw new Error('failed to gett article tickers');
    return response.json();
}

export async function getArticleFromArticleId(articleId: string) {
    return articleId;
}
