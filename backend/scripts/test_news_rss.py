import sys
from pathlib import Path

# Make the backend package (this folder) the import root so that
# `services` and `schemas` can be imported like in the main app.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.news_rss import fetch_crypto_news_from_rss


def main() -> None:
    """
    Quick manual test for RSS-based crypto news fetching.

    Prints a few normalized articles so you can verify:
      - title
      - content_summary
      - dayPub
      - link
    """

    articles = fetch_crypto_news_from_rss(limit_per_feed=3)

    print(f"Total articles fetched: {len(articles)}")
    print("-" * 80)

    for idx, article in enumerate(articles[:15], start=1):
        print(f"[{idx}] {article['title']}")
        print(f"  dayPub          : {article['dayPub']}")
        if article["content_summary"]:
            print(f"  content_summary : {article['content_summary']}")
        if article["link"]:
            print(f"  link            : {article['link']}")
        print("-" * 80)


if __name__ == "__main__":
    main()

