// const config = {
//     externals: {
//         puppeteer: 'require("puppeteer")',
//         // ...
//     },
// }

const path = require('path');
module.exports = {
    entry: './src/main.ts',
    externals: {
        puppeteer: 'require("puppeteer")',
    }
};
