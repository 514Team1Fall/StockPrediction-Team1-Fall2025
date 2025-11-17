import os
import json
import hashlib
import urllib.parse
import urllib.request
import boto3

ALPHA_ENDPOINT = 'https://www.alphavantage.co/query?function=NEWS_SENTIMENT'

def fetch_json(url: str, method: str = 'GET', body: dict | None = None, timeout_sec: int = 20) -> dict:
    data = None
    headers = {'Content-Type': 'application/json'}
    if body is not None:
        data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        charset = resp.headers.get_content_charset() or 'utf-8'
        text = resp.read().decode(charset)
        if resp.status < 200 or resp.status >= 300:
            raise RuntimeError(f"HTTP {resp.status} for {url}: {text}")
        return json.loads(text)


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
    try:
        created = fetch_json(f"{api_base_url}/articles", method='POST', body=body)
        return created
    except Exception as e:
        # If exists (409), compute deterministic id and continue
        msg = str(e)
        if 'HTTP 409' in msg:
            return {"articleId": compute_article_id(article.get("url"))}
        raise


def upsert_ticker_sentiment(api_base_url: str, article_id: str, s: dict) -> None:
    body = {
        "tickerSymbol": s.get("ticker"),
        "tickerSentimentScore": s.get("ticker_sentiment_score"),
        "tickerSentimentLabel": s.get("ticker_sentiment_label"),
        "relevanceScore": s.get("relevance_score"),
    }
    # Will raise if non-2xx
    fetch_json(f"{api_base_url}/articles/{article_id}/tickers", method='POST', body=body)


def chunk(seq: list[str], size: int) -> list[list[str]]:
    return [seq[i:i + size] for i in range(0, len(seq), size)]


def ingest_batch(api_base_url: str, api_key: str, symbols: list[str], known_symbols: set[str]) -> None:
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

            created = upsert_article(api_base_url, item)
            article_id = created.get('articleId')
            if not article_id:
                continue
            sentiments = [s for s in (item.get('ticker_sentiment') or []) if s.get('ticker') in known_symbols]
            for s in sentiments:
                try:
                    upsert_ticker_sentiment(api_base_url, article_id, s)
                except Exception as inner:
                    print(f"ERROR upserting sentiment for {item.get('url')}: {inner}")
        except Exception as outer:
            print(f"ERROR processing article {item.get('url')}: {outer}")


def handler(event, context):
    api_key = os.environ.get('ALPHAVANTAGE_API_KEY')
    api_base_url = os.environ.get('API_BASE_URL')

    if not api_key or not api_base_url:
        raise RuntimeError('Missing required env: ALPHAVANTAGE_API_KEY or API_BASE_URL')

    all_tickers = get_all_tickers(api_base_url)
    stock_symbols = [t["symbol"] for t in all_tickers if t.get("type") == 'stock' and t.get("symbol")]
    unique = list(dict.fromkeys(stock_symbols))  # preserve order & unique
    known = set(unique)
    batches = chunk(unique, 10)

    for b in batches:
        ingest_batch(api_base_url, api_key, b, known)

    body = {"ok": True, "batches": len(batches)}
    return {"statusCode": 200, "body": json.dumps(body)}


