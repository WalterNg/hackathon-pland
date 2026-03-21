import asyncio
import os
from datetime import date, timedelta

import yfinance as yf


async def main() -> None:
    """
    Quick manual test for yfinance.Ticker.get_news.

    - Uses a sample ticker (AAPL by default).
    - Prints out a few fields so you can inspect what Yahoo Finance returns.
    """

    ticker = os.getenv("YF_TEST_TICKER", "AAPL")
    days_back = int(os.getenv("YF_TEST_DAYS_BACK", "7"))

    today = date.today()
    start = today - timedelta(days=days_back)

    print(f"Testing yfinance.get_news for ticker={ticker}, "
          f"from {start.isoformat()} to {today.isoformat()}")

    stock = yf.Ticker(ticker)
    # Raw articles from Yahoo Finance via yfinance
    articles = stock.get_news(count=20, tab="news")

    print(f"Total articles returned: {len(articles)}")
    print("-" * 80)
    print(articles)

    # for idx, article in enumerate(articles, start=1):
    #     # Handle both flat and nested 'content' structures
    #     content = article.get("content", article)
    #     title = content.get("title", "No title")
    #     summary = content.get("summary", "")
    #     provider = content.get("provider", {})
    #     publisher = provider.get("displayName") or content.get("publisher", "Unknown")
    #     url_obj = content.get("canonicalUrl") or content.get("clickThroughUrl") or {}
    #     link = url_obj.get("url", content.get("link", ""))

    #     print(f"[{idx}] {title} (source: {publisher})")
    #     if summary:
    #         print(summary)
    #     if link:
    #         print(f"Link: {link}")
    #     print("-" * 80)


if __name__ == "__main__":
    asyncio.run(main())

