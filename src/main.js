// For more information, see https://crawlee.dev/
import { PuppeteerCrawler, ProxyConfiguration, Dataset } from "crawlee";
import { router } from "./routes.js";

const startUrls = ["https://secure.college-ic.ca/search-new/EN"];

// Define the crawler
const crawler = new PuppeteerCrawler({
  launchContext: {
    launchOptions: {
      headless: false, // Set to true if running in a non-GUI environment
    },
  },

  async requestHandler({ page, request, enqueueLinks }) {
    // Go to the page URL
    await page.goto(request.url, { waitUntil: "domcontentloaded" });

    // Wait for the dropdown to be loaded in the DOM and to be visible
    await page.waitForSelector("#search_membership_status", {
      visible: true,
      timeout: 3000,
    });

    await page.select("#search_membership_status", "7");
    // Select the "Resigned" option from the dropdown
    await page.waitForSelector("#full_search_submit_button", {
      visible: true,
      timeout: 1000,
    });
    await Promise.all([
      await page.click("#full_search_submit_button"), // Assumes this is the correct selector for the search button
    ]).then(console.log("Pressed"));

    //here add to wait for 3 secs
    await page.waitForTimeout(3000);


    const data = await page.evaluate(() => {
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

    // Log the data and save it
    console.log("Data scraped:", data);
    if (data.length > 0) {
      await Dataset.pushData(data);
    } else {
      console.log("No data found on the page:", request.url);
    }

    // Enqueue pagination links if this was a form submission
    if (request.userData.formSubmitted) {
      await enqueueLinks({
        selector: "ul.pagination li a",
        userData: { formSubmitted: true },
      });
    }
  },

  // Maximum requests per crawl. Adjust as necessary.
  maxRequestsPerCrawl: 100,

  // Function to be called when the crawl has finished
  handleFailedRequestFunction: async ({ request }) => {
    console.error(`Request ${request.url} failed too many times`);
  },
});

// Run the crawler
await crawler.run(startUrls);
