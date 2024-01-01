export function randomword (wordList){
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


// Shuffle function
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Initialize shuffled indices and used indices
let shuffledIndices = [];
let usedIndices = new Set();

export function getRandomPair(jsonData, langlang, isExplain = false) {

  if (shuffledIndices.length === 0) {
    // All indices have been used, reshuffle
    shuffledIndices = shuffleArray(Array.from(Array(jsonData.length).keys()));
    usedIndices.clear(); // Clear used indices
  }

  let randomIndex = shuffledIndices.pop();
  while (usedIndices.has(randomIndex)) {
    // If the index has been used, get a new one
    randomIndex = shuffledIndices.pop();
  }

  usedIndices.add(randomIndex);

  const randomPair = jsonData[randomIndex];

  let front, back, norskexplanation;

  if (isExplain) {
    if (
      randomPair &&
      ('norsk' in randomPair) &&
      ('english' in randomPair) &&
      ('norskexplanation' in randomPair)
    ) {
      const { norsk, english, norskexplanation } = randomPair;

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
    } else {
      throw new Error('Invalid data structure for explanation in JSON');
      // Handle the error case by throwing an error or returning a default response
    }
  } else {
    if (randomPair && ('norsk' in randomPair) && ('english' in randomPair)) {
      const { norsk, english } = randomPair;

      if (langlang === 'noreng') {
        front = norsk;
        back = english;
      } else if (langlang === 'engnor') {
        front = english;
        back = norsk;
      }
    } else {
      throw new Error('Invalid data structure in JSON');
      // Handle the error case by throwing an error or returning a default response
    }
  }

  return isExplain ? { front, back, norskexplanation } : { front, back };
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
