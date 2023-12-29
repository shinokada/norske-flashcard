import { promises as fs } from 'fs';
import puppeteer from 'puppeteer';

async function scrapeDictionaryData() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    // Scraping first URL
    await page.goto('https://the-unl.com/100-most-common-adjectives-in-norwegian-165', {
      waitUntil: 'domcontentloaded',
    });

    const dataOne = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.content ol li'));

      return items.map(item => {
        const [norsk, english] = item.textContent.trim().split(' - ');
        return { norsk, english };
      });
    });

    // Scraping second URL
    await page.goto('https://extralanguages.com/most-common-adjectives-in-norwegian/', {
      waitUntil: 'domcontentloaded',
    });

    const dataTwo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr:not(:first-child)'));

      return rows.map(row => {
        const [english, norsk] = Array.from(row.querySelectorAll('td:nth-child(1), td:nth-child(2)'))
          .map(cell => cell.textContent.trim());
        return { norsk, english };
      });
    });

    // Merging and filtering to avoid duplicates
    const combinedData = [...dataOne, ...dataTwo];
    const uniqueData = combinedData.reduce((acc, current) => {
      const exists = acc.some(item => item.norsk === current.norsk);
      if (!exists) {
        acc.push(current);
      }
      return acc;
    }, []);

    const jsonContent = JSON.stringify(uniqueData, null, 2);
    await fs.writeFile('src/lib/data/adjectives.json', jsonContent);

    console.log('All data extracted and saved to adjectives.json');
  } catch (error) {
    console.error('Error occurred during scraping:', error);
  } finally {
    await browser.close();
  }
}

scrapeDictionaryData();
