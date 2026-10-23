#!/usr/bin/env python3
"""Prepare the three Heidrun articles as drafts in a personal-blog checkout."""

import argparse
from datetime import datetime
import html
import json
from pathlib import Path
import re


POSTS = (
    ("three-features", "Managing several coding agents starts with knowing which task needs attention."),
    ("development-history", "Recover the reasoning behind a real Heidrun change from conversations and development records."),
    ("day-of-development", "Examine a measured week of coding agent use, with explicit scope and counting rules."),
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", required=True, type=Path, help="Root of an existing personal-blog checkout")
    args = parser.parse_args()
    source = Path(__file__).resolve().parent.parent / "docs" / "blog_posts"
    destination = args.destination.resolve() / "web" / "_blog"
    if not destination.is_dir():
        parser.error("The destination must already contain web/_blog.")

    prepared = []
    documents = {}
    names = {}
    for index, (slug, synopsis) in enumerate(POSTS, start=1):
        text = (source / (slug + ".blog_post.md")).read_text()
        parts = text.split("\n\n", 2)
        if len(parts) != 3 or not parts[0].startswith("# "):
            parser.error("An article must have a title, a metadata header, and a body: " + slug)
        title, metadata, body = parts[0][2:], parts[1], parts[2]
        created = next((line[11:] for line in metadata.splitlines() if line.startswith("- Created: ")), None)
        if created is None:
            parser.error("Missing creation date: " + slug)
        draft_date = datetime.strptime(created, "%d %B %Y").strftime("%Y-%m-%d")
        names[slug] = draft_date + "-heidrun-" + str(index).zfill(2) + "-" + slug + ".md"
        documents[slug] = (title, synopsis, draft_date, body)

    for slug, _ in POSTS:
        title, synopsis, draft_date, body = documents[slug]
        for other, filename in names.items():
            body = body.replace(other + ".blog_post.md", filename.replace(".md", ".html"))
        # Match the personal blog's existing responsive illustration markup.
        body = re.sub(
            r"!\[([^\]]*)\]\((images/[^)]+)\)",
            lambda match: '<div class="d-flex justify-content-center my-4"><img class="w-100" src="./'
            + html.escape(match[2], quote=True) + '" alt="' + html.escape(match[1], quote=True) + '"/></div>',
            body,
        )
        fields = {
            "title": title,
            "layout": "post",
            "author": "Jerome Etienne",
            "author_url": "https://bsky.app/profile/jerome-etienne.bsky.social",
            "draft": True,
            "synopsis": synopsis,
            "image": "/blog/images/" + slug + ".png",
            "date": draft_date,
            "tags": ["heidrun", "ai", "workflow"],
        }
        frontmatter = "---\n" + "\n".join(key + ": " + json.dumps(value, ensure_ascii=False) for key, value in fields.items()) + "\n---\n\n"
        prepared.append((destination / names[slug], (frontmatter + body).encode()))
        image = source / "images" / (slug + ".png")
        prepared.append((destination / "images" / image.name, image.read_bytes()))

    # Validate every destination before writing, and preserve existing edited drafts.
    for path, content in prepared:
        if path.exists() and path.read_bytes() != content:
            parser.error("Refusing to overwrite a different file: " + str(path))
    for path, content in prepared:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_bytes(content)
        print(path)
    print("Prepared three drafts. Dates are creation dates; no publication is scheduled.")


if __name__ == "__main__":
    main()
