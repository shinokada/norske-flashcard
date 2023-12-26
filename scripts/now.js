import puppeteer from "puppeteer";
import fs from "fs/promises";

const getQuotes = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  await page.goto("https://www.ntnu.edu/web/now/vocabulary/list", {
    waitUntil: "domcontentloaded",
  });

  const norskwords = await page.evaluate(() => {
    const ingressElements = document.querySelectorAll("div.ingress p, div.innholdstekst p");

    const data = [];

    ingressElements.forEach((pElement) => {
      const spans = Array.from(pElement.querySelectorAll("span[style*='font-family:']"));
      spans.forEach((span) => {
        let particle = span.textContent.trim();

        const anchorElement = span.nextElementSibling;
  
        if (anchorElement && anchorElement.tagName === 'A') {
          let norskWord = anchorElement.textContent.trim().replace(/=/g, '').replace(/\)/g, '').trim();
         
          norskWord = `${particle} ${norskWord}`
          
          let englishWord = '';
          
          // Extract English word between ") =" and "<br />"
          // const text = pElement.textContent;
          // console.log('text', text)
          // const startIndex = text.indexOf(') = ') + 4; // Adjusting to the end of the pattern
          // const endIndex = text.indexOf('<br />', startIndex);

          // if (startIndex !== -1 && endIndex !== -1) {
          //   englishWord = text.slice(startIndex, endIndex).trim();
          // }

          // console.log('englishWord', englishWord)

          if (norskWord) {
            data.push({ norsk: norskWord  });
          }
        }
      });
    });
  
    return data;
  });
  
  try {
    await fs.writeFile("src/lib/ntnu-now-v2.json", JSON.stringify(norskwords, null, 2));
    console.log("Data saved to norskwords.json");
  } catch (err) {
    console.error("Error writing to file:", err);
  }

  await browser.close();
};

getQuotes();