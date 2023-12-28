// For more information, see https://crawlee.dev/
import { PuppeteerCrawler, ProxyConfiguration, Dataset } from "crawlee";
import { router } from "./routes.js";

const startUrls = ["https://secure.college-ic.ca/search-new/EN"];

const crawler = new PuppeteerCrawler({
  launchContext: {
    launchOptions: {
      headless: false, // Set to true if running in a non-GUI environment
    },
  },

  async requestHandler({ page, request }) {
    // Go to the page URL
    await page.goto(request.url, { waitUntil: "domcontentloaded" });

    // Wait for the dropdown to be loaded in the DOM and to be visible
    await page.waitForSelector("#search_membership_status", {
      visible: true,
      timeout: 3000,
    });

    // Select the "Resigned" option from the dropdown
    await page.select("#search_membership_status", "7");

    // Wait for the submit button to be clickable
    await page.waitForSelector("#full_search_submit_button", {
      visible: true,
      timeout: 1000,
    });

    // Click the submit button and wait for the results to load
    await page.click("#full_search_submit_button");
    console.log("Submit button clicked");

    // Wait for 3 seconds after the click
    await page.waitForTimeout(3000);

    // Scrape data from the page
    let data = await scrapeData(page);
    console.log("1st page Data scraped:", data);
    await Dataset.pushData(data);

    // Pagination loop
    let currentPage = 1;
    let hasNextPage = true;
    while (hasNextPage) {
      currentPage += 1; // Prepare to load the next page
      hasNextPage = await page.evaluate((currentPage) => {
        // Use the current page number to find the next link
        const nextLinkSelector = `ul#pager li a[href="#page-${currentPage}"]:not(.disabled)`;
        const nextLink = document.querySelector(nextLinkSelector);
        console.log("prepare to click:", currentPage);
        if (nextLink) {
          nextLink.click(); // Click the next page link
          return true; // There is a next page
        }
        return false; // No next page link found
      }, currentPage);

      // If there is a next page, wait for the page to load and scrape the data
      if (hasNextPage) {
        // Generate a random number between 5000 and 7000
        const randomTimeout =
          Math.floor(Math.random() * (7000 - 5000 + 1)) + 5000;
        // Wait for the random timeout
        await page.waitForTimeout(randomTimeout);

        console.log("Work on Page: ", currentPage);
        data = await scrapeData(page);
        console.log("Page no. ", currentPage, " Data scraped:", data);
        await Dataset.pushData(data);
      }
    }
  },

  // Function to be called when the crawl has finished
  handleFailedRequestFunction: async ({ request }) => {
    console.error(`Request ${request.url} failed too many times`);
  },
});

// Function to scrape data from the current page
async function scrapeData(page) {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("#search_results tr"));
    return rows.map((row) => {
      const cells = row.querySelectorAll("td");
      return {
        Name: cells[0]?.textContent.trim(),
        Status: cells[1]?.textContent.trim(),
        ID: cells[3]?.textContent.trim(), // Assuming you want the 4th column (index 3)
      };
    });
  });
}

// Run the crawler with the start URLs
await crawler.run(startUrls);
