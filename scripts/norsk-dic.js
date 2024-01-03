// dict source: https://github.com/Dani7B/Norwegian2EnglishDict/blob/master/4_finalDictionary/nb-NOtoENdictionary.txt


import fs from 'fs/promises';

async function scrapeVocabularyData() {
  try {
    const dataFile = await fs.readFile('./scripts/data/nb-NOtoENdictionary.txt', 'utf-8');
    const lines = dataFile.split('\n');

    const allData = lines.map(line => {
      const [norsk, english] = line.split('\t');
      return {
        norsk: norsk.trim(),
        english: english.trim(),
      };
    });

    const jsonContent = JSON.stringify(allData, null, 2);
    await fs.writeFile('src/lib/data/norsk-dic.json', jsonContent);

    console.log('All data extracted and saved to norsk-dic.json');
  } catch (error) {
    console.error('Error occurred during scraping:', error);
  }
}

scrapeVocabularyData();
