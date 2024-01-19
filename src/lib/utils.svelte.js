import randomInteger from 'random-int';

export function randomword (wordList) {
  return wordList[Math.floor(Math.random() * wordList.length)];
}

export function getRandomItemFromDictionary (dictionary) {
  const keys = Object.keys(dictionary);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  
  return {
    [randomKey]: dictionary[randomKey]
  };
}

// export function oldGetRandomPair(jsonData) {
//   const randomIndex = Math.floor(Math.random() * jsonData.length);
//   const randomPair = jsonData[randomIndex];
//   const { norsk, english } = randomPair;
//   return { norsk, english };
// }

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
  // const randomIndex = randomInteger(0, jsonData.length - 1); // Generate a random index
  const randomIndexFn = randomNumberGenerator(0, jsonData.length - 1, maxConsecutiveRepeats)
  
  const randomIndex = randomIndexFn();
  // console.log(randomIndex)
  const randomPair = jsonData[randomIndex];
  // console.log('randomPair', randomPair)
  let front
  let back
  
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
  if( website === 'google'){
    baseUrl = 'https://translate.google.com/?hl=en&tab=TT&sl=no&tl=en&op=translate&text='
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
