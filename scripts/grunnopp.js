// grunnopp.js

import { promises as fs } from 'fs';
import puppeteer from 'puppeteer';

async function scrapeDictionaryData() {
  const browser = await puppeteer.launch({
    headless: "new"
  });

  const page = await browser.newPage();

  try {
    await page.goto('https://www.udir.no/verktoy/ordbok/', {
      waitUntil: 'networkidle0',
    });

    const acceptButton = await page.$('button.coi-banner__accept');
    if (acceptButton) {
      await acceptButton.click();
    }

    const characters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å'];
    // const characters = ['A', 'B', 'C']
    let allData = [];

    for (const currentPage of characters) {
      await page.waitForSelector(`button.dictionary-letters__button[value="${currentPage}"]`);
      await page.click(`button.dictionary-letters__button[value="${currentPage}"]`);
      await page.waitForTimeout(1000);
      
      await page.waitForSelector('.dictionary__table-row');

      const pageData = await page.evaluate(() => {
        const tableRows = Array.from(document.querySelectorAll('.dictionary__table-row'));
    
        return tableRows.map(row => {
          const norsk = row.querySelector('.dictionary__result-target div')?.textContent.trim();
          const english = row.querySelector('.dictionary__result-translation div')?.textContent.trim();
    
          return {
            norsk,
            english
          };
        });
      });

      if (Array.isArray(pageData)) {
        allData.push(...pageData);
      } else {
        console.error(`Invalid data format for page ${currentPage}`);
      }

      console.log(`Scraped data for page ${currentPage}`);
    }

    const jsonContent = JSON.stringify(allData, null, 2);
    await fs.writeFile('src/lib/grunnopp_data.json', jsonContent);

    console.log('All data extracted and saved to extracted_data.json');

  } catch (error) {
    console.error('Error occurred during scraping:', error);
  } finally {
    await browser.close();
  }
}

scrapeDictionaryData();
