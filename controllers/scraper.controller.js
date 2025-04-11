const scraperService = require('../services/scrapper.service');

exports.handleScrape = async (req, res) => {
    try {
        const result = await scraperService.scrapeAndSendToSpring();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Scraping failed'});
    }
};

exports.testLogContent = async (req, res) => {
    try {
        const result = await scraperService.logPageContents();
        res.json(result); // return preview so you can see something
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Logging failed' });
    }
};