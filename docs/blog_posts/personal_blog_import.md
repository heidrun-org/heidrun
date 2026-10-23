# Personal blog draft import

- Created: 17 October 2026
- Last updated: 17 October 2026
- Status: Imported personal-blog drafts with a repeatable import procedure
- Related framing: [Series plan](blog_series_plan.md)
- Related rules: [Project glossary](../agents_rules/glossary/index.md), [Marketing images](../marketing/images.md)
- Related issue: [issue #642](https://github.com/heidrun-org/heidrun/issues/642)

## Developer Decision

The developer selected “Keep all three as drafts for now” on 17 October 2026, reviewed the result, and requested the merge. Every imported article has `draft: true`. The file dates and frontmatter dates are the draft creation date, 17 October 2026, and do not establish a publication schedule.

## Imported Destination

The reviewed articles and illustrations were merged into the personal blog's `main` branch through [pull request #16](https://github.com/jeromeetienne/jeromeetienne.github.io/pull/16). The destination preserves the existing article and image hierarchy:

| Source article | Personal-blog article |
| --- | --- |
| [three-features.blog_post.md](three-features.blog_post.md) | [First article](https://github.com/jeromeetienne/jeromeetienne.github.io/blob/main/web/_blog/2026-10-17-heidrun-01-three-features.md) |
| [development-history.blog_post.md](development-history.blog_post.md) | [Second article](https://github.com/jeromeetienne/jeromeetienne.github.io/blob/main/web/_blog/2026-10-17-heidrun-02-development-history.md) |
| [day-of-development.blog_post.md](day-of-development.blog_post.md) | [Third article](https://github.com/jeromeetienne/jeromeetienne.github.io/blob/main/web/_blog/2026-10-17-heidrun-03-day-of-development.md) |

Each matching PNG is in `web/_blog/images`. Imported copies use the blog's existing frontmatter fields, omit repository documentation metadata, convert article-to-article links to the corresponding HTML pages, and use the existing responsive image markup. Alternative text is preserved. The imported illustration and the social message attachment are the same image.

The import is repeatable with [scripts/import_blog_posts.py](../../scripts/import_blog_posts.py). From the Heidrun checkout, pass the root of an existing personal-blog checkout:

```bash
python3 scripts/import_blog_posts.py --destination /Users/jetienne/webwork/jeromeetienne.github.io
```

The script validates all destinations before writing, skips identical files, and refuses to overwrite an existing file with different content. Importing does not publish or schedule an article. For later revisions, reconcile edited destination drafts before replacing them with revised source articles.

## Build and Review

Before merging, the articles were imported into a temporary local checkout of the personal blog inside the Heidrun worktree. The existing personal-blog builder was run against that checkout, reusing the builder's already-installed dependencies through a local symbolic link. From a personal-blog checkout with those dependencies installed, the build command is:

```bash
node --import ./contribs/static_builder/node_modules/tsx/dist/loader.mjs ./contribs/static_builder/src/cli.ts build -s ./web -d ./dist --base-url https://jeromeetienne.github.io
```

The build completed successfully and produced all three HTML pages and images. Browser inspection checked the article layout, responsive illustrations, the second article's navigation, and the third article's table. All three drafts were absent from the blog index and sitemap. The existing builder still emits directly addressable HTML pages for drafts; the preview was local and no deployment was run.

To serve a locally built preview from the personal-blog checkout:

```bash
python3 -m http.server 8642 --bind 127.0.0.1 --directory dist
```

The source articles, evidence, social messages, illustrations, and import procedure remain in the Heidrun repository. The temporary review checkout is removed when the Issue Fix Workflow is completed.
