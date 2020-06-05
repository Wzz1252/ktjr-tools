const playwright = require('playwright');

/**
 * 爬虫核心抓取
 */
export default class ReptileCore {
    private corePage: any = null;

    public async run(): Promise<any> {
        this.corePage = await this.getChromiumPage();
        return;
    }

    private async getChromiumPage(): Promise<any> {
        const browser = await playwright.chromium.launch();
        const context = await browser.newContext();
        return await context.newPage();
    }


}


(async () => {
    for (const browserType of ['chromium']) {
        console.log("xxxxxxx: ", browserType);
        const browser = await playwright[browserType].launch();
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto('https://www.baidu.com/');
        await page.screenshot({path: `/Users/torment/Workspace/electron/angular-electron/example-${browserType}.png`});
        await browser.close();
    }
})();

