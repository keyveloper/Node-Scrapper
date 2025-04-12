const puppeteer = require('puppeteer');
const { XMLParser } = require('fast-xml-parser');


exports.getScrappedDataByKeywords = async (keywords) => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });


    try {
        const result = {};
        let i = 0;
        for (const keyword of keywords) {
            // search and go to blog tab
            await page.goto('https://www.naver.com', {waitUntil: 'domcontentloaded'});
            await page.waitForSelector('#query');

            await page.type('#query', keyword);
            await page.keyboard.press('Enter');

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

            if (!blogTabClicked) throw new Error("Blog tab not found");

            // scrap data...
            console.log("🙄... scrapping start...");
            console.log(`🔍 Searching for keyword: ${keyword}`);

            result[keyword] = {};
            // make postCountMap ...
            result[keyword].postMeaningfullCountMonthly = await scrapPostingCountMonthly(page, keyword);

            const blogs = await scrapTopBlogs(page);

            // make blog map ...
            const blogInfoMap = {};
            let index = 1;

            result[keyword].blogs = []
            for (const blog of blogs) {
                blogInfoMap.title = blog.title;
                blogInfoMap.bloggerId = blog.bloggerId;
                blogInfoMap.rank = index;

                const visitStatsMap = await scrapVisitorStats(browser, blog.bloggerId);

                result[keyword].blogs.push({...blogInfoMap, ...visitStatsMap});
                index++;
            }
        }

        console.log(`result: ${JSON.stringify(result, null, 2)}`);
        await browser.close();
        return { status: 'done', result };

    } catch (error) {
        console.error("❌ Error in ScrappedData:", error);
        await browser.close();
        return { status: 'fail', error: error.message };
    }
}



async function scrapVisitorStats(browser, bloggerId) {
    const page = await browser.newPage();

    try {
        await page.goto(
            `https://blog.naver.com/NVisitorgp4Ajax.nhn?blogId=${bloggerId}`,
            { waitUntil: 'networkidle2' }
        );

        const xmlText = await page.evaluate(() => document.body.innerText);
        console.log('🧾 Raw XML:', xmlText);

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });

        const json = parser.parse(xmlText);
        console.log('✅ Parsed XML to JSON:', JSON.stringify(json, null, 2));

        const visitData = json.visitorcnts?.visitorcnt;

        const visits = Array.isArray(visitData) ? visitData : [visitData];
        const counts = visits.map(v => parseInt(v['@_cnt'])).filter(n => !isNaN(n));

        if (counts.length === 0) {
            console.warn(`⚠️ No valid visitor counts for bloggerId: ${bloggerId}`);
            return { average: 0, min: 0, max: 0 };
        }

        const sum = counts.reduce((a, b) => a + b, 0);
        const average = Math.round(sum / counts.length);
        const min = Math.min(...counts);
        const max = Math.max(...counts);

        console.log(`📊 Stats for ${bloggerId} → avg: ${average}, min: ${min}, max: ${max}`);
        await page.close();
        return { average, min, max };
    } catch (error) {
        console.error(`❌ Failed to fetch stats for ${bloggerId}:`, error.message);
        return { average: 0, min: 0, max: 0 };
    }
}

async function scrapTopBlogs(page) {
    // blog info...
    await page.waitForSelector('.title_area', { timeout: 3000 });

    return await page.evaluate(() => {
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
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapPostingCountMonthly(blogViewPage, keyword) {
    try {
        // 1) Wait for the page’s date‑option function to be ready
        await blogViewPage.waitForFunction(
            () => typeof view_submit_date_option === 'function',
            { timeout: 5000 }
        );

        // 2) Invoke the “1개월” filter (option index 4)
        await blogViewPage.evaluate(() => view_submit_date_option(4));
        console.log('📌 Applied 1개월 filter via JS API');

        // 3) Wait for navigation / results to reload
        await blogViewPage.waitForNavigation({ waitUntil: 'networkidle2' });

        // 4) Ensure at least one result is visible
        await blogViewPage.waitForSelector('ul.lst_view li.bx', { visible: true });
        console.log('📌 Filter applied, results loaded.');


        const tokens = keyword
            .trim()
            .split(/\s+/)
            .map(w => w.toLowerCase());

        // 5) Infinite‑scroll until no more new items load
        let prevMeaningful = 0;
        while (true) {
            await blogViewPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await sleep(1000);

            const anchorDetails = await blogViewPage.$$eval(
                '.title_link',
                anchors => anchors.map(a => ({
                    href: a.href,
                    text: a.textContent.trim(),
                }))
            );
            console.log(anchorDetails);

            const currMeaningful = await blogViewPage.$$eval(
                '.title_link',
                (anchors, tokens) =>
                    anchors.filter(a => {
                        const title = (a.textContent || '').toLowerCase();
                        return tokens.every(t => title.includes(t));
                    }).length,
                tokens
            );

            if (currMeaningful === prevMeaningful) break;
            prevMeaningful = currMeaningful;
        }
        console.log('📌 Reached end of list.');

        return prevMeaningful ;

    } catch (error) {
        console.error(`❌ Failed to scrap monthly count:`, error);
        return -1;
    }
}