import { promises as fs } from 'fs';
import puppeteer from 'puppeteer';

async function scrapeVocabularyData() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    await page.goto('https://vocab.chat/blog/most-common-norwegian-words.html', {
      waitUntil: 'domcontentloaded',
    });

    const data = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#main-list li'));

      return items.map(item => {
        const norsk = item.querySelector('.vocab').textContent.trim();
        const englishElement = item.querySelector('.definition');
        let english = englishElement ? englishElement.textContent.replace(/^\(|\)$/g, '').replace(/\[|\]/g, '').trim() : "";

        // Check if English translation appears to be missing
        if (!english || english.trim().length === 0) {
          english = "N/A";
        }
        
        return { norsk, english };
      });
    });

    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile('src/lib/data/one-thousand-vocabulary.json', jsonContent);

    console.log('All data extracted and saved to one-thousand-vocabulary.json');
  } catch (error) {
    console.error('Error occurred during scraping:', error);
  } finally {
    await browser.close();
  }
}

scrapeVocabularyData();
