const express = require('express');
const router = express.Router();
const controller
    = require('../controllers/scraper.controller')

router.get('/run', controller.handleScrape);

router.get('/log', controller.testLogContent);

module.exports = router;