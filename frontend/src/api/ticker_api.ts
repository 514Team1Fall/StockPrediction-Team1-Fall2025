import type { Ticker } from "../../../api/src/db/schema";

const TICKER_API_ROUTE = '/api/tickers';


export async function searchTicker(tickerSymbol: string): Promise<Ticker | null>  { //convert uppercase always 
    const response = await fetch(`${TICKER_API_ROUTE}/${tickerSymbol}`, {
        credentials: "include",
    });

    console.log(`searhced  tickers: ..`, response)

    if (!response.ok) throw new Error('failed to get tickers');

    return response.json();
}
