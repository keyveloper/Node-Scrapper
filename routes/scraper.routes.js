const express = require('express');
const router = express.Router();
const scrapperService
    = require('../services/scrapper.service')

router.post('/run', async (req, res) => {
    const { keywords } = req.body;

    console.log(`📌 keywords: ${keywords}, ${Array.isArray(keywords)}`);
    try {
        const result = await scrapperService.getScrappedDataByKeywords(keywords);
        res.json(result);
    } catch (error) {
        console.error("❌ Error in /run route:", error);
        res.status(500).json({ status: 'fail', message: error.message })
    }
});

module.exports = router;