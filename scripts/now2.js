import puppeteer from "puppeteer";
import fs from "fs/promises";

const getQuotes = async () => {
  // Start a Puppeteer session with:
  // - a visible browser (`headless: false` - easier to debug because you'll see the browser in action)
  // - no default viewport (`defaultViewport: null` - website page will in full width and height)
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  // Open a new page
  const page = await browser.newPage();

  // On this new page:
  // - open the "http://quotes.toscrape.com/" website
  // - wait until the dom content is loaded (HTML is ready)
  await page.goto("https://www.ntnu.edu/web/now2/gloser/liste", {
    waitUntil: "domcontentloaded",
  });

  // Get page data
  const norskwords = await page.evaluate(() => {
    const detailList = document.querySelectorAll("details");
    const data = [];
  
    detailList.forEach((detail) => {
      const norsk = detail.querySelector("audio").nextElementSibling.textContent.trim();
      let english = detail.querySelector("a[href]").nextSibling.textContent.trim();
      english = english.replace(/=/g, '').replace(/\)/g, '').trim();

      const norskexplanation = detail.querySelector("font[color='blue']").textContent.trim();
  
      data.push({ norsk, english, norskexplanation });
    });
  
    return data;
  });
  
  try {
    await fs.writeFile("src/lib/data/ntnu-now2.json", JSON.stringify(norskwords, null, 2));
    console.log("Data saved to norskwords.json");
  } catch (err) {
    console.error("Error writing to file:", err);
  }

  // Close the browser
  await browser.close();
};

// Start the scraping
getQuotes();