import type { HeadConfig } from 'vitepress';
import identity from '../../../../../data/identity.json';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	LinkPreviewCards — builds the tags that give a link to the website its preview card
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The data that the card of one page needs. */
export type LinkPreviewCardPage = {
	/** The address of the website with its base path and a final slash, such as `https://example.org/heidrun/`. */
	siteAddress: string;
	/** The title of the page, as written in the tag `title`. */
	title: string;
	/** The description of the page, as written in the tag `meta name="description"`. */
	description: string;
	/** The path of the Markdown source of the page, relative to the folder `docs`, such as `features/panes.md`. */
	relativePath: string;
};

/** Builds the Open Graph tags, the X card tags, the theme color tag, and the canonical address of the website. */
export class LinkPreviewCards {
	/** The file name of the card image in the folder `docs/public`. */
	static readonly imageFileName = 'heidrun_link_preview_card.png';

	/** The width of the card image, in pixels. */
	static readonly imageWidth = 1200;

	/** The height of the card image, in pixels. */
	static readonly imageHeight = 630;

	/** The sentence that describes the card image for people who cannot see it. */
	static readonly imageAlt = 'The goat Heiðrún on the tree Læraðr above a golden vessel of mead, next to the name Heidrun.';

	/** The color that Discord draws at the left of the card: the mead color of the application. */
	static readonly themeColor = '#f2a93b';

	/** The language and the country of the text of the website, in the form that Open Graph wants. */
	static readonly locale = 'en_US';

	/**
	 * Builds the tags that are the same on every page.
	 * @param siteAddress - The address of the website with its base path and a final slash.
	 * @returns The tags for the option `head` of the configuration.
	 */
	static sharedTags(siteAddress: string): HeadConfig[] {
		const imageAddress = `${siteAddress}${LinkPreviewCards.imageFileName}`;
		return [
			['meta', {
				name: 'theme-color',
				content: LinkPreviewCards.themeColor,
			}],
			['meta', {
				property: 'og:type',
				content: 'website',
			}],
			['meta', {
				property: 'og:site_name',
				content: identity.title,
			}],
			['meta', {
				property: 'og:locale',
				content: LinkPreviewCards.locale,
			}],
			['meta', {
				property: 'og:image',
				content: imageAddress,
			}],
			['meta', {
				property: 'og:image:type',
				content: 'image/png',
			}],
			['meta', {
				property: 'og:image:width',
				content: String(LinkPreviewCards.imageWidth),
			}],
			['meta', {
				property: 'og:image:height',
				content: String(LinkPreviewCards.imageHeight),
			}],
			['meta', {
				property: 'og:image:alt',
				content: LinkPreviewCards.imageAlt,
			}],
			['meta', {
				name: 'twitter:card',
				content: 'summary_large_image',
			}],
			['meta', {
				name: 'twitter:image',
				content: imageAddress,
			}],
			['meta', {
				name: 'twitter:image:alt',
				content: LinkPreviewCards.imageAlt,
			}],
		];
	}

	/**
	 * Builds the tags that are different on every page.
	 * @param page - The title, the description, and the source path of the page, and the address of the website.
	 * @returns The tags to add to the `head` of this page.
	 */
	static pageTags(page: LinkPreviewCardPage): HeadConfig[] {
		const pageAddress = LinkPreviewCards.pageAddress(page.siteAddress, page.relativePath);
		return [
			['link', {
				rel: 'canonical',
				href: pageAddress,
			}],
			['meta', {
				property: 'og:url',
				content: pageAddress,
			}],
			['meta', {
				property: 'og:title',
				content: page.title,
			}],
			['meta', {
				property: 'og:description',
				content: page.description,
			}],
			['meta', {
				name: 'twitter:title',
				content: page.title,
			}],
			['meta', {
				name: 'twitter:description',
				content: page.description,
			}],
		];
	}

	/**
	 * Gives the address that a visitor opens for a page.
	 * @param siteAddress - The address of the website with its base path and a final slash.
	 * @param relativePath - The path of the Markdown source of the page, relative to the folder `docs`.
	 * @returns The full address: `index.md` gives the address of its folder, and any other `name.md` gives `name.html`.
	 */
	static pageAddress(siteAddress: string, relativePath: string): string {
		const path = relativePath
			.replace(/\.md$/, '.html')
			.replace(/(^|\/)index\.html$/, '$1');
		return `${siteAddress}${path}`;
	}
}
