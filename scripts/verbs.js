// there is also https://github.com/benbarbersmith/grokily/blob/master/data/norsk_verbs.csv is a good resource

import { promises as fs } from 'fs';
import puppeteer from 'puppeteer';

async function scrapeDictionaryData() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    await page.goto('http://www.lindaunwin.com/verbs.htm', {
      waitUntil: 'domcontentloaded',
    });

    const data = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));

      const extractedData = [];

      for (let i = 9; i < rows.length; i++) {
        const tds = rows[i].querySelectorAll('td');

        if (tds.length >= 7 && tds[1].innerText.trim() !== '') {
          let norsk = '';

          // Concatenate 2nd to 5th td innerText to norsk with commas
          for (let j = 1; j <= 4; j++) {
            norsk += tds[j].innerText.trim();
            if (j !== 4) norsk += ', ';
          }

          const english = tds[6].innerText.trim();

          if (norsk !== '') {
            const modifiedEnglish = `to ${english.toLowerCase()}`;

            extractedData.push({ norsk, english: modifiedEnglish });
          }
        }
      }

      return extractedData;
    });


    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile('src/lib/data/verbs.json', jsonContent);

    console.log('All data extracted and saved to verbs.json');
  } catch (error) {
    console.error('Error occurred during scraping:', error);
  } finally {
    await browser.close();
  }
}

scrapeDictionaryData();
