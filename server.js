// Starts the Express server. Like main() in Spring
const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Scraper serer running on port ${PORT}`)
});