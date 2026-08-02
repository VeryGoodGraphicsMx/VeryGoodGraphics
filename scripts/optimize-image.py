"""Create a web-ready WebP derivative without overwriting the source image."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--max-width", type=int, default=1600)
    parser.add_argument("--quality", type=int, default=84)
    args = parser.parse_args()

    with Image.open(args.source) as image:
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        if image.width > args.max_width:
            height = round(image.height * args.max_width / image.width)
            image = image.resize((args.max_width, height), Image.Resampling.LANCZOS)
        args.destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(args.destination, "WEBP", quality=args.quality, method=6)

    print(f"{args.destination} ({args.destination.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
