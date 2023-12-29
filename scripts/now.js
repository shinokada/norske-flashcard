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

    ingressElements.forEach((element) => {
      const text = element.innerText
      data.push(text)
    });
  
    return data;
  });
  
  try {
    await fs.writeFile("scripts/norsk-eng.txt", norskwords.join('\n') + '\n');
    console.log('Text appended to file.');
  } catch (err) {
    console.error('Error appending to file:', err);
  }

  await browser.close();
};



const parseNorskEngFile = async () => {
  try {
    const data = await fs.readFile('scripts/norsk-eng.txt', 'utf-8');
    // const sanitizedData = Buffer.from(data, 'utf-8').toString('utf-8');
    const lines = data.split('\n');

    const result = lines.map((line) => {
      const bracketIndex = line.indexOf('(');
      const equalIndex = line.indexOf('=');

      if (bracketIndex !== -1 && equalIndex !== -1) {
        const norsk = line.slice(0, bracketIndex).trim();
        let english = line.slice(equalIndex + 1).trim();

      if (english === 'proper name') {
        english = norsk;
      }
        return {
          norsk,
          english,
        };
      } else {
        return null; // Line doesn't match the pattern
      }
    }).filter(Boolean); // Remove null entries

    const jsonOutput = JSON.stringify(result, null, 2);

    await fs.writeFile('src/lib/data/ntnu-now.json', jsonOutput, 'utf-8');
    console.log('Data written to norsk-eng.json file successfully.');
  } catch (err) {
    console.error('Error:', err);
  }
};

getQuotes();
// Call the function to parse and write to file
parseNorskEngFile();