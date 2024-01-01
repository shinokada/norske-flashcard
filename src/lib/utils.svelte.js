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

  let front;
  let back;
  let norskexplanation;

  if ('norsk' in randomPair && 'english' in randomPair) {
    if (isExplain) {
      if ('norskexplanation' in randomPair) {
        norskexplanation = randomPair.norskexplanation;
      }

      if (langlang === 'noreng') {
        front = randomPair.norsk;
        back = randomPair.english;
      } else if (langlang === 'engnor') {
        front = randomPair.english;
        back = randomPair.norsk;
      } else if (langlang === 'nornor') {
        front = norskexplanation;
        back = randomPair.norsk;
      }

      return { front, back, norskexplanation };
    } else {
      if (langlang === 'noreng') {
        front = randomPair.norsk;
        back = randomPair.english;
      } else if (langlang === 'engnor') {
        front = randomPair.english;
        back = randomPair.norsk;
      }

      return { front, back };
    }
  } else {
    // Handle cases where norsk and english properties are not available in the JSON
    // Return an appropriate response or throw an error
    // For example:
    throw new Error('Invalid data structure in JSON');
    // or
    return { error: 'Invalid data structure in JSON' };
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
