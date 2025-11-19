import os
import json
import hashlib
import urllib.parse
import urllib.request
import urllib.error
import boto3

ALPHA_ENDPOINT = 'https://www.alphavantage.co/query?function=NEWS_SENTIMENT'

def fetch_json(url: str, method: str = 'GET', body: dict | None = None, timeout_sec: int = 20) -> dict:
    data = None
    headers = {'Content-Type': 'application/json'}
    if body is not None:
        data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            charset = resp.headers.get_content_charset() or 'utf-8'
            text = resp.read().decode(charset)
            if resp.status < 200 or resp.status >= 300:
                raise RuntimeError(f"HTTP {resp.status} for {url}: {text}")
            return json.loads(text)
    except urllib.error.HTTPError as e:
        # Handle HTTP errors
        error_text = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
        raise RuntimeError(f"HTTP {e.code} for {url}: {error_text}")


def get_all_tickers(api_base_url: str) -> list[dict]:
    url = f"{api_base_url}/tickers/byType/all"
    rows = fetch_json(url)
    return [{"symbol": r.get("symbol"), "type": r.get("type")} for r in rows]


def compute_article_id(url: str) -> str:
    h = hashlib.sha256()
    h.update((url or "").strip().encode('utf-8'))
    return h.hexdigest()


def upsert_article(api_base_url: str, article: dict) -> dict:
    body = {
        "title": article.get("title"),
        "url": article.get("url"),
        "summary": article.get("summary"),
        "publishedAt": article.get("time_published") or article.get("published_at"),
    }
    if "overallSentimentScore" in article:
        body["overallSentimentScore"] = article["overallSentimentScore"]
    if "overallSentimentLabel" in article:
        body["overallSentimentLabel"] = article["overallSentimentLabel"]
    
    article_url = article.get("url")
    article_id = compute_article_id(article_url)
    
    try:
        created = fetch_json(f"{api_base_url}/articles", method='POST', body=body)
        return created
    except Exception as e:
        # If exists (409 Conflict)
        msg = str(e)
        if '409' in msg or 'Conflict' in msg:
            return {"articleId": article_id}
        raise


def is_valid_ticker_symbol(symbol: str) -> bool:
    """Validate ticker symbol format. Returns False for invalid formats."""
    if not symbol or not isinstance(symbol, str):
        return False
    symbol = symbol.strip().upper()
    
    # Skip forex pairs
    if symbol.startswith('FOREX:'):
        return False
    
    # Skip crypto with prefix
    if symbol.startswith('CRYPTO:'):
        return False
    
    # Skip empty or too long
    if len(symbol) == 0 or len(symbol) > 32:
        return False
    
    # Skip single character tickers (except valid ones like K, F)
    if len(symbol) == 1 and symbol not in ['K', 'F', 'C']:
        return False
    
    # Only allow alphanumeric and common characters
    if not all(c.isalnum() or c in ['-', '.'] for c in symbol):
        return False
    
    return True


def normalize_ticker_symbol(symbol: str) -> tuple[str, str] | None:
    """
    Normalize ticker symbol and determine type.
    Returns (normalized_symbol, type) or None if invalid.
    """
    if not symbol or not isinstance(symbol, str):
        return None
    
    symbol = symbol.strip().upper()
    
    # Handle crypto with prefix
    if symbol.startswith('CRYPTO:'):
        crypto_symbol = symbol.replace('CRYPTO:', '').strip()
        if is_valid_ticker_symbol(crypto_symbol):
            return (crypto_symbol, 'crypto')
        return None
    
    # Skip forex
    if symbol.startswith('FOREX:'):
        return None
    
    # Regular stock ticker
    if is_valid_ticker_symbol(symbol):
        return (symbol, 'stock')
    
    return None


def upsert_ticker_sentiment(api_base_url: str, article_id: str, s: dict, symbol: str, ticker_type: str) -> None:
    """Upsert ticker sentiment. Symbol and type should already be normalized."""
    body = {
        "tickerSymbol": symbol,
        "tickerType": ticker_type,  # Pass type to API
        "tickerSentimentScore": s.get("ticker_sentiment_score"),
        "tickerSentimentLabel": s.get("ticker_sentiment_label"),
        "relevanceScore": s.get("relevance_score"),
    }
    
    fetch_json(f"{api_base_url}/articles/{article_id}/tickers", method='POST', body=body)


def chunk(seq: list[str], size: int) -> list[list[str]]:
    return [seq[i:i + size] for i in range(0, len(seq), size)]


def ingest_batch(api_base_url: str, api_key: str, symbols: list[str]) -> None:
    tickers_param = ','.join(symbols)
    url = f"{ALPHA_ENDPOINT}&tickers={urllib.parse.quote(tickers_param)}&apikey={urllib.parse.quote(api_key)}"
    data = fetch_json(url)
    feed = data.get('feed') or data.get('articles') or []
    comprehend = boto3.client('comprehend')
    for item in feed:
        try:
            # Overall sentiment with Comprehend (combine title + summary; English)
            try:
                title = item.get("title") or ""
                summary = item.get("summary") or ""
                text = (title + ". " + summary).strip()
                if text:
                    res = comprehend.detect_sentiment(Text=text[:4800], LanguageCode='en')
                    label = res.get("Sentiment")
                    scores = res.get("SentimentScore", {})
                    signed = float(scores.get("Positive", 0.0)) - float(scores.get("Negative", 0.0))
                    item["overallSentimentLabel"] = label
                    item["overallSentimentScore"] = round(signed, 4)
            except Exception as se:
                print(f"ERROR comprehend sentiment: {se}")

            try:
                created = upsert_article(api_base_url, item)
                article_id = created.get('articleId')
                if not article_id:
                    continue
                
                # Process ALL tickers from Alpha Vantage (API will auto-create missing ones)
                sentiments = item.get('ticker_sentiment') or []
                for s in sentiments:
                    ticker_symbol = s.get('ticker')
                    if not ticker_symbol:
                        continue
                    
                    # Validate and normalize ticker symbol
                    normalized = normalize_ticker_symbol(ticker_symbol)
                    if not normalized:
                        continue
                    
                    try:
                        symbol, ticker_type = normalized
                        upsert_ticker_sentiment(api_base_url, article_id, s, symbol, ticker_type)
                    except Exception as inner:
                        print(f"ERROR upserting sentiment for ticker {ticker_symbol} (normalized: {symbol}) in article {item.get('url')}: {inner}")
            except Exception as article_error:
                error_msg = str(article_error)
                # 409 is expected
                if '409' in error_msg or 'Conflict' in error_msg:
                    continue
                print(f"ERROR processing article {item.get('url')}: {article_error}")
        except Exception as outer:
            print(f"ERROR processing article {item.get('url')}: {outer}")


def handler(event, context):
    api_key = os.environ.get('ALPHAVANTAGE_API_KEY')
    api_base_url = os.environ.get('API_BASE_URL')

    if not api_key or not api_base_url:
        raise RuntimeError('Missing required env: ALPHAVANTAGE_API_KEY or API_BASE_URL')

    # Get existing stock tickers to query Alpha Vantage
    all_tickers = get_all_tickers(api_base_url)
    stock_symbols = [t["symbol"] for t in all_tickers if t.get("type") == 'stock' and t.get("symbol")]
    unique = list(dict.fromkeys(stock_symbols))
    
    # If no tickers exist, use a default set of major tickers to seed initial data
    if not unique:
        unique = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "NFLX"]
        print(f"No tickers in DB, using default set: {unique}")
    
    batches = chunk(unique, 10)

    for b in batches:
        ingest_batch(api_base_url, api_key, b)

    body = {"ok": True, "batches": len(batches)}
    return {"statusCode": 200, "body": json.dumps(body)}


