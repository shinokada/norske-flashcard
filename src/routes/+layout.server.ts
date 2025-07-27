import { ANALYTICS_ID_LANGUAGE_APP } from '$env/static/private';
import type { MetaProps } from 'runes-meta-tags';
import { metaTitle, metaDescription, metaImg } from 'runes-meta-tags';

export const load = ({ url }) => {
	const title = metaTitle(url.pathname, __NAME__);
	const basicDesc = 'Master Norwegian Vocabulary with Flashcard.';
	const description = metaDescription(url.pathname, basicDesc);
	const image = metaImg(url.pathname, __NAME__);

	const layoutMetaTags: MetaProps = {
		title,
		description,
		keywords: 'Norwegian, language game, flashcards, learning, language',
		twitter: {
			card: 'summary_large_image',
			site: '@shinokada',
			creator: '@shinokada',
			title,
			description,
			image,
			imageAlt: title
		},
		og: {
			type: 'website',
			title,
			description,
			url: url.href,
			image,
			imageAlt: title,
			siteName: 'Norske Flashcard',
			imageWidth: '1200',
			imageHeight: '630'
		}
	};
	return {
		layoutMetaTags,
		ANALYTICS_ID_LANGUAGE_APP
	};
};
