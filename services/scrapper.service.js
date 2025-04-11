const puppeteer = require('puppeteer');
const axios = require('axios');

exports.logPageContents = async () => {
    const browser = await puppeteer.launch({ headless: false })
    const page = await browser.newPage()

    // adjust page size
    await page.setViewport({
        width: 	1920,
        height: 1080
    })

    await page.goto('https://www.naver.com', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#query');
    await page.type('#query', '아이폰 15');
    await page.keyboard.press('Enter')

    await page.waitForSelector('a[role="tab"].tab');

    const blogTabClicked = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a[role="tab"].tab'));
        const blogTab = tabs.find(tab => tab.textContent.includes('블로그'));
        if (blogTab) {
            blogTab.click();
            return true;
        }
        return false;
    });

    if (!blogTabClicked) {
        console.log("❌ Can't find blog tab...");
        return { status: 'fail' };
    }

    console.log("✅ Clicked blog tab");

    await page.waitForSelector('.title_link', { timeout: 3000 });

    const blogs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.title_link'))
            .slice(0, 10)
            .map(a => {
                const href = a.getAttribute('href');
                const bloggerIdMatch = href.match(/blog\.naver\.com\/([^/]+)/);
                return {
                    title: a.textContent.trim(),
                    bloggerId: bloggerIdMatch ? bloggerIdMatch[1] : null
                };
            });
    });

    console.log(blogs);

    return { status: 'done' };
}