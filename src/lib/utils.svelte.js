export function removeHyphensAndCapitalize(str) {
  // Handle empty string or strings without '-'
  if (!str || !str.includes('-')) {
    return str;
  }

  // Capitalize the first letter (including after hyphens)
  const capitalized = str.replace(/(^|\s|-)\w/g, (match) => match.toUpperCase());

  // Remove hyphens and ensure spaces after words
  return capitalized.replace(/-|\s{2,}/g, ' ');
}

export function randomword (wordList) {
	return wordList[Math.floor(Math.random() * wordList.length)];
}

export function getRandomItemFromDictionary(dictionary) {
	const keys = Object.keys(dictionary);
	const randomKey = keys[Math.floor(Math.random() * keys.length)];

	return {
		[randomKey]: dictionary[randomKey]
	};
}

const randomNumberGenerator = (min, max, maxConsecutiveRepeats) => {
	let previousNumbers = [];

	return () => {
		let randomNumber;

		do {
			randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
		} while (previousNumbers.includes(randomNumber));

		if (previousNumbers.length >= maxConsecutiveRepeats) {
			previousNumbers.shift();
		}

		previousNumbers.push(randomNumber);

		return randomNumber;
	};
};

export function getRandomPair(jsonData, langlang, isExplain = false, maxConsecutiveRepeats = 50) {
	const randomIndexFn = randomNumberGenerator(0, jsonData.length - 1, maxConsecutiveRepeats);

	const randomIndex = randomIndexFn();
	// console.log(randomIndex)
	const randomPair = jsonData[randomIndex];
	// console.log('randomPair', randomPair)
	let front;
	let back;

	if (isExplain) {
		let { norsk, english, norskexplanation } = randomPair;

		if (langlang === 'noreng') {
			front = norsk;
			back = english;
		} else if (langlang === 'engnor') {
			front = english;
			back = norsk;
		} else if (langlang === 'nornor') {
			front = norskexplanation;
			back = norsk;
		}

		return { front, back, norskexplanation };
	} else {
		let { norsk, english } = randomPair;

		if (langlang === 'noreng') {
			front = norsk;
			back = english;
		} else if (langlang === 'engnor') {
			front = english;
			back = norsk;
		}

		return { front, back };
	}
}

export function openTab(word, website) {
	let baseUrl = '';
	if (website === 'google') {
		baseUrl = 'https://translate.google.com/?hl=en&tab=TT&sl=no&tl=en&op=translate&text=';
	} else {
		baseUrl = 'https://ordbokene.no/bm/search?q=';
	}

	const url = baseUrl + encodeURIComponent(word);
	window.open(url, '_blank');
}

export function cleanWord(word) {
	// Remove characters after '/'
	let withoutSlash = word.replace(/\/.*$/, '');

	// Remove characters after ','
	let withoutComma = withoutSlash.replace(/,.*/, '');

	// Remove characters after ' -'
	let withoutHyphen = withoutComma.replace(/ -.*/, '');

	return withoutHyphen.trim(); // Trim to remove leading/trailing spaces
}
