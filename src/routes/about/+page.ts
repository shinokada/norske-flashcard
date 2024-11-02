import { metaTitle, metaDescription, splitAndCapitalize } from 'runes-meta-tags';

export const load = ({ url }) => {
	const title = metaTitle(url.pathname, __NAME__);
	const basicDesc = splitAndCapitalize(__NAME__);
	const description = metaDescription(url.pathname, basicDesc);

	const pageMetaTags = {
		title,
		description,
		og: {
			title,
			description
		},
		twitter: {
			title,
			description
		}
	};
	return { pageMetaTags };
};
