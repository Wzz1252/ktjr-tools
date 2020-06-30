const page = require('webpage').create();
const system = require('system');
const fs = require('fs');

/** 民生银行支持的最大查询次数 */
const QUERY_MAX_DAYS = 183;
/** 重试间隔 */
const RETRY_INTERVAL = 200; // ms
/** 重试次数 */
const RETRY_NUMBER = 25;
/** 重试次数 获取页面 */
const RETRY_NUMBER_FOR_PAGE = RETRY_NUMBER;
/** 图片宽度 */
const RENDER_WIDTH = 1920;
/** 页数获取时间 */
const PAGE_ITEM = 100;
/** 生成的图片格式 */
const IMAGE_FORMAT = ".jpeg"

/** 放款 code 传 000000 */
const MODE_LOAN = "loan";
/** 放款 code 传 argvContractNo */
const MODE_LOAN_CODE = "loan_code";
/** 垫付 */
const MODE_ADVANCE = "advance";

let currentRetryNumberForPage: number = 1;

let argvUrl: string = system.args[1];
let argvOutput: string = system.args[2];
let argvWaitTime: number = system.args[3];
/** 放款日期 */
let argvLoanDate: string = system.args[4];
/** 首次垫付日期 */
let argvStartAdvanceDate: string = system.args[5];
/** 末次垫付日期 */
let argvEndAdvanceDate: string = system.args[6];
/** 产品代码 */
let argvProductCode: string = system.args[7];
/** 合同编号 */
let argvContractNo: string = system.args[8];
/** 最大查询次数 */
let maxQueryDay: number = 0;

let runStartDate: number = 0;
let runEndDate: number = 0;

/** 处理分页问题*/
let totalPage: number = 1;
let currentPage: number = 1;

let userAccount: string = 'error';
let userAccountName: string = 'error';

// 页面初始高度
page.viewportSize = {width: RENDER_WIDTH, height: 200};

page.open(argvUrl, function (status) {
    runStartDate = new Date().getTime();
    initSettings();
    if (status === 'success') {
        log('页面加载成功...');
        log('');
        // page.evaluate(addHeaderImage());

        // parseAccInfoMenu(() => {
        //     recursiveParseTransDetailMenu(0, 'loan', () => {
        //         recursiveParseTransDetailMenu(0, 'advance',
        //             () => exitProgram(true),
        //             () => exitProgram(false));
        //     }, () => exitProgram(false));
        // }, () => exitProgram(false));

        parseAccInfoMenu(() => {
            recursiveParseTransDetailMenu(0, MODE_LOAN, () => {
                recursiveParseTransDetailMenu(0, MODE_LOAN_CODE, () => {
                    recursiveParseTransDetailMenu(0, MODE_ADVANCE,
                        () => exitProgram(true),
                        () => exitProgram(false));
                }, fail => exitProgram(false));
            }, () => exitProgram(false));
        }, () => exitProgram(false));
    } else {
        error('未知错误，请检查参数是否正确。');
        exitProgram(false);
    }
});

function initSettings() {
    if (!argvUrl) {
        error('error', '需要设置抓取URL！');
        exitProgram(false);
    }
    if (!argvOutput) {
        error('error', '需要设置输出地址！');
        exitProgram(false);
    }

    argvWaitTime = argvWaitTime || 1000;
    maxQueryDay = Math.ceil(dateDiff(argvStartAdvanceDate, argvEndAdvanceDate) / QUERY_MAX_DAYS);
    log("-------------------初始结果：", maxQueryDay);

    log('');
    log('>>>>>>>>> 基本设置 <<<<<<<<<');
    log('目标地址：\t\t', argvUrl);
    log('输出目录：\t\t', argvOutput);
    log('放款日期：\t\t', argvLoanDate);
    log('首次垫付日期：\t', argvStartAdvanceDate);
    log('末次垫付日期：\t', argvEndAdvanceDate);
    log('产品代码：\t\t', argvProductCode);
    log('合同编号：\t\t', argvContractNo);
    log('重试时间：\t\t', `${RETRY_INTERVAL} ms`);
    log('重试次数：\t\t', RETRY_NUMBER);
    log('页数获取时间：\t', `${PAGE_ITEM} ms`);
    log('渲染宽度：\t\t', `${RENDER_WIDTH} px`);
    log('>>>>>>>>> 基本设置 <<<<<<<<<');
    log('');
}

/** 解析账户总览并生成图片 */
function parseAccInfoMenu(success: Function, fail: Function) {
    log('>>>>>>>>> 开始解析[账户总览] <<<<<<<<<');
    let ret: any = simulatedClick('accInfoMenu');
    if (ret === -1) fail();

    pollView('账户总览菜单', 0, () => {
        return page.evaluate(function () {
            let ifm: any = document.getElementById('pageSelect');
            if (!ifm) return {status: '-1'};
            let nDocument = ifm.contentWindow.document;
            if (!nDocument) return {status: '-1'};
            let clr8e1 = nDocument.getElementsByClassName('clr_8e')[1];
            if (!clr8e1) return {status: '-1'};
            let clr8e2 = nDocument.getElementsByClassName('clr_8e')[2];
            if (!clr8e2) return {status: '-1'};
            let account = clr8e1.innerText || '';
            let accountName = clr8e2.innerText || '';
            return {status: '200', data: {account: account, accountName: accountName}};
        } as any);
    }, (data: any) => {
        userAccount = data.account;
        userAccountName = data.accountName;
        setScrollHeight();
        page.render(getOutputPath(argvContractNo + '-1账号' + IMAGE_FORMAT));
        log('渲染成功，文件路径：' + getOutputPath(argvContractNo + '-1账号' + IMAGE_FORMAT));
        log('');
        success();
    }, () => {
        fail();
    });
}

/**
 * 解析交易明细并生成图片
 * @maxNum 递归基础 传 0
 * @mode loan 放款、advance 垫付
 */
function recursiveParseTransDetailMenu(maxNum: number, mode: string, success: Function, fail: Function) {
    log(`>>>>>>>>> 开始解析[${mode === 'loan' ? ' 放  款 ' : ' 垫  付 '}] <<<<<<<<<`);
    if (mode === MODE_LOAN || mode == MODE_LOAN_CODE) {
        if (maxNum > 0) return success();
    } else {
        if (maxNum >= maxQueryDay) return success();
    }
    currentRetryNumberForPage = 1;

    function nativeFun() {
        if (currentRetryNumberForPage > RETRY_NUMBER_FOR_PAGE) {
            jumpProgram();
            return;
        }
        setStartDateAndEndDateAndRefreshPage(maxNum, mode, (startDate: string, endDate: string) => {
            log(`模式：${mode === 'loan' ? '[放款]' : '[垫付]'}，开始时间：${startDate}，结束时间：${endDate}`);
            ++maxNum;
            getTotalPage((page: number) => {
                if (String(page) === "0") {
                    --maxNum;
                    ++currentRetryNumberForPage;
                    log(`最大页数为 0，获取最大页面数失败，重试中 ${currentRetryNumberForPage}`);
                    nativeFun();
                    return;
                }
                totalPage = page;
                log(`模式：${mode === 'loan' ? '[放款]' : '[垫付]'}，最大页数：${totalPage}`);
                nextTransDetailPage(maxNum, mode, startDate, endDate,
                    () => {
                        recursiveParseTransDetailMenu(maxNum, mode, success, fail);
                    },
                    () => fail());
            }, () => fail());
        }, () => {
            fail();
        });
    }

    totalPage = 0;
    currentPage = 1;
    if (maxNum === 0) {
        log('首次，进行菜单切换...');
        let ret = simulatedClick('transDetailMenu');
        if (ret === -1) fail();
        resetTotalPage(maxNum, mode, () => nativeFun(), () => fail());
    } else {
        log('已切换到指定菜单，跳过...');
        resetTotalPage(maxNum, mode, () => nativeFun(), () => fail());
        // nativeFun();
    }
}

function nativeRenderFun(maxNum: number, mode: string, startDate: string, endDate: string,
                         success: Function, fail: Function) {
    pollView(`模式：[${mode}]，渲染前的准备`, 0,
        () => {
            return page.evaluate(function (currentPage: number, totalPage: number) {
                let ifm: any = document.getElementById('pageSelect');
                if (!ifm) return {status: '-1'};
                let nDocument = ifm.contentWindow.document;
                if (!nDocument) return {status: '-1'};
                let pas = nDocument.getElementsByClassName('pa')[0];
                if (!pas) return {status: '-1'};
                let pa: any = pas.getElementsByTagName('a');
                if (!pa) return {status: '-1'};
                let jumpView = nDocument.getElementById('jumptoPageIndex');
                if (!jumpView) return {status: '-1'};
                let msPage = nDocument.getElementsByClassName('ms_page');
                if (!msPage) return {status: '-1'};
                let msPageItem = msPage[1];
                if (!msPageItem) return {status: '-1'};

                // 如果相同，说明页面是原来的，但实际没加载完成
                let selectPages = msPageItem.innerHTML.split('第');
                let selectPage = selectPages[1].split('页')[0];
                if (String(selectPage) !== String(currentPage)) {
                    return {status: '-2', data: {selectPage: selectPage}};
                }

                let code = '-1';
                jumpView.value = currentPage;
                for (let i = 0; i < pa.length; i++) {
                    if (pa[i].innerHTML === '跳转') code = '200';
                }

                // TODO 将 iframe 中的内容进行替换
                let wapper = document.getElementsByClassName("wapper")[1];
                let div: any = document.getElementById("custom_core_id");
                if (!div) {
                    div = document.createElement("div");
                    div.setAttribute("id", "custom_core_id");
                    wapper.insertBefore(div, ifm);
                }
                div.innerHTML = nDocument.getElementsByTagName("html")[0].innerHTML;
                ifm.style.display = "none";
                ifm.style.width = "1px";
                ifm.style.height = "1px";

                // @ts-ignore
                document.getElementsByClassName("mian_right")[0].style.backgroundColor = "#ffffff";
                // @ts-ignore
                document.getElementsByClassName("mian_right")[0].style.width = "1009px";
                // @ts-ignore
                document.getElementsByClassName("mian_right")[0].style.marginLeft = "241px";

                // @ts-ignore
                document.getElementById("btn_query").style.marginTop = "0px";

                // @ts-ignore
                document.getElementsByClassName("mian_biao")[0].style.width = "1190px";
                // @ts-ignore
                document.getElementsByClassName("mian_biao")[0].style.marginLeft = "20px";

                // @ts-ignore
                return {status: code, data: {select: document.getElementById("custom_core_id").id}};
            } as any, currentPage, totalPage);
        },
        (data: any) => {
            // TODO TEST
            console.log("==========================================: ", data.select)
            renderHtml(maxNum, mode, startDate, endDate);
            ++currentPage;
            nextTransDetailPage(maxNum, mode, startDate, endDate, success, fail);
        },
        (data: any, err: any) => {
            if (err.status === '-2') {
                log(`未加载完成: currentPage: [${currentPage}]  selectPage: [${data.selectPage}]`);
            }
            fail();
        }, currentPage, totalPage);
}

function nextTransDetailPage(maxNum: number, mode: string, startDate: string, endDate: string,
                             success: Function, fail: Function) {
    if (currentPage === 1) {
        log('第一页单独处理');
        nativeRenderFun(maxNum, mode, startDate, endDate, success, fail);
    } else {
        if (currentPage > totalPage) {
            success();
        } else {
            pollView(`分页[${currentPage}]`, 0,
                () => {
                    return page.evaluate(function (currentPage: number, totalPage: number) {
                        let ifm: any = document.getElementById('pageSelect');
                        if (!ifm) return {status: '-1'};
                        let nDocument = ifm.contentWindow.document;
                        if (!nDocument) return {status: '-1'};
                        let pas = nDocument.getElementsByClassName('pa')[0];
                        if (!pas) return {status: '-1'};
                        let pa: any = pas.getElementsByTagName('a');
                        if (!pa) return {status: '-1'};
                        let jumpView = nDocument.getElementById('jumptoPageIndex');
                        if (!jumpView) return {status: '-1'};

                        jumpView.value = currentPage;
                        for (let i = 0; i < pa.length; i++) {
                            if (pa[i].innerHTML === '跳转') {
                                pa[i].click();
                                return {status: '200'};
                            }
                        }
                        return {status: '-1'};
                    } as any, currentPage, totalPage);
                },
                (data: any) => {
                    nativeRenderFun(maxNum, mode, startDate, endDate, success, fail);
                },
                (err: any) => {
                    fail();
                }, currentPage, totalPage);
        }
    }
}

/** 如果是第一页，需要更新数据，否则直接拿来用 */
function setStartDateAndEndDateAndRefreshPage(maxNum: number, mode: string,
                                              success: (startDate: string, endDate: string) => void,
                                              fail: Function) {
    let date: any = {startDate: '', endDate: ''};
    if (mode === MODE_LOAN || mode === MODE_LOAN_CODE) {
        date = getLoanDate(argvLoanDate);
    } else {
        date = getStartAndEndDate2(maxNum, argvStartAdvanceDate, argvEndAdvanceDate);
    }

    let startDate = date.startDate;
    let endDate = date.endDate;

    pollView('交易明细菜单', 0,
        () => {
            return page.evaluate(function (startDate: string, endDate: string, mode: string, argvProductCode: string) {
                let ifm: any = document.getElementById('pageSelect');
                if (!ifm) return {status: '-1', message: 'ifm null'};
                let nDocument = ifm.contentWindow.document;
                if (!nDocument) return {status: '-1', message: 'nDocument null'};
                let startDateView = nDocument.getElementById('startDate');
                if (!startDateView) return {status: '-1', message: 'startDateView null'};
                let endDateView = nDocument.getElementById('endDate');
                if (!endDateView) return {status: '-1', message: 'endDateView null'};
                let btnQueryView = nDocument.getElementById('btn_query');
                if (!btnQueryView) return {status: '-1', message: 'btnQueryView null'};
                let prdCodeView = nDocument.getElementById('prdCode');
                if (!prdCodeView) return {status: '-1', message: 'prdCodeView null'};

                // 对 放款与垫付 进行优化
                if (mode === 'loan') {
                    prdCodeView.value = '000000';
                } else if (mode === 'loan_code') {
                    prdCodeView.value = argvProductCode || '';
                } else {
                    prdCodeView.value = argvProductCode || '';
                }

                // // ------------- 调整UI -------------
                // // @ts-ignore
                // document.getElementsByClassName("wapper")[1].style.backgroundColor = "#00f";
                // // @ts-ignore
                // document.getElementsByClassName("mian_left")[0].style.backgroundColor = "#f0f";
                // // nDocument.getElementById("queryForm").style.width = "1015px";
                // // nDocument.getElementById("queryForm").style.color = "#0ff";
                // let queryForm = nDocument.getElementById("queryForm");
                // queryForm.style.backgroundColor = "#0ff";
                // prdCodeView.style.color = "#0f0";
                // // queryForm.style.backgroundColor = "rgb(0, 0, 0)";
                //
                // let mian_right = nDocument.getElementsByClassName("mian_right")[0];
                // mian_right.style.backgroundColor = "rgb(255,0,0)";
                // // nDocument.getElementsByClassName("mian_title")[0].style = "background-color: #00f";
                //
                // // // 获取 wapper ，得到 iframe
                // // let wapper = document.getElementsByClassName("wapper")[1];
                // //
                // // let div: any = document.createElement("div");
                // // div.innerHTML = nDocument.getElementsByTagName("html")[0].innerHTML;
                // // // div.innerHTML = ifm;
                // // wapper.insertBefore(div, ifm);
                // // // nDocument.getElementsByTagName("html")[0].style.display="none";
                //
                // // ------------- 调整UI -------------

                startDateView.value = startDate;
                endDateView.value = endDate;

                btnQueryView.click();
                return {status: '200', message: '', data: {message: "1111"}};
            } as any, startDate, endDate, mode, argvProductCode);
        },
        (data: any) => {
            console.log("--------------: ", data.message);
            success(startDate, endDate);
        },
        () => {
            fail();
        });
}

/** 对页数进行重置 随便数据股票代码，确保内容一定为空 */
function resetTotalPage(maxNum: number, mode: string, success: Function, fail: Function) {
    log("对页数进行重置");
    let date: any = {startDate: '', endDate: ''};
    if (mode === 'loan') date = getLoanDate(argvLoanDate);
    else date = getStartAndEndDate2(maxNum, argvStartAdvanceDate, argvEndAdvanceDate);

    let startDate = date.startDate;
    let endDate = date.endDate;

    pollView('重置页数', 0,
        () => {
            return page.evaluate(function (startDate: string, endDate: string, mode: string, argvProductCode: string) {
                let ifm: any = document.getElementById('pageSelect');
                if (!ifm) return {status: '-1', message: 'ifm null'};
                let nDocument = ifm.contentWindow.document;
                if (!nDocument) return {status: '-1', message: 'nDocument null'};
                let startDateView = nDocument.getElementById('startDate');
                if (!startDateView) return {status: '-1', message: 'startDateView null'};
                let endDateView = nDocument.getElementById('endDate');
                if (!endDateView) return {status: '-1', message: 'endDateView null'};
                let btnQueryView = nDocument.getElementById('btn_query');
                if (!btnQueryView) return {status: '-1', message: 'btnQueryView null'};
                let prdCodeView = nDocument.getElementById('prdCode');
                if (!prdCodeView) return {status: '-1', message: 'prdCodeView null'};

                prdCodeView.value = 'XXXXXXXXX';
                startDateView.value = startDate;
                endDateView.value = endDate;

                btnQueryView.click();

                return {status: '200', message: ''};
            } as any, startDate, endDate, mode, argvProductCode);
        },
        () => {
            log("重置页数，开始获取新的页数，确保页数为 0（表示重置成功）");
            recursiveTotalPage(0, RETRY_NUMBER, () => success(), () => fail());
        },
        () => fail());
}

function recursiveTotalPage(num: number, maxNum: number, success: Function, fail: Function) {
    if (num >= maxNum) {
        fail();
        return;
    }
    getTotalPage((page: number) => {
        if (String(page) === "0") {
            log("重置页面成功");
            success(); // 成功
            return;
        } else {
            ++num;
            log(`重置页面失败，当前的错误页数：${page}，重试次数[${num}]`);
            recursiveTotalPage(num, maxNum, success, fail); // 失败
        }
    }, () => {
        fail();
        return;
    });
}

/**
 * 获得当前的最大页数
 * @param success
 * @param fail
 */
function getTotalPage(success: (page: number) => void, fail: Function): void {
    log(`准备获取最大页数，定时 ${RETRY_INTERVAL} 毫秒`);
    setTimeout(function () {
        pollView('获取最大页数', 0,
            () => {
                return page.evaluate(function () {
                    let ifm: any = document.getElementById('pageSelect');
                    if (!ifm) return {status: '-1'};
                    let nDocument = ifm.contentWindow.document;
                    if (!nDocument) return {status: '-1'};
                    let msPage = nDocument.getElementsByClassName('ms_page');
                    if (!msPage) return {status: '-1'};
                    let msPageItem = msPage[1];
                    if (!msPageItem) return {status: '-1'};

                    return {status: '200', data: {html: msPageItem.innerHTML || ''}};
                } as any);
            },
            (data: any) => {
                let pageTotals = data.html.split('共');
                if (!pageTotals || pageTotals.length < 4) return fail();
                success(Number(pageTotals[3].split('页')[0]) || 0);
            },
            () => {
                fail();
            });
    }, RETRY_INTERVAL);
}

/** 渲染HTML，并生成图片 */
function renderHtml(maxNum: number, mode: string, startDate: string, endDate: string) {
    setScrollHeight();
    let filePrefix = '';
    if (mode === MODE_LOAN) {
        filePrefix = '2放款流水_N';
    } else if (mode === MODE_LOAN_CODE) {
        filePrefix = '2放款流水_C';
    } else {
        filePrefix = '3垫付流水';
    }
    log('准备完成，开始渲染...');
    let fileName = argvContractNo + '-' + filePrefix + '-' + startDate + '-' + endDate + '-PAGE-' + autoFilZero(currentPage, 4) + IMAGE_FORMAT;
    page.render(getOutputPath(fileName));
    log('渲染成功，文件路径：' + getOutputPath(fileName));
    log('');
}

/**
 * 模拟点击
 * @return -1 失败，其余成功
 */
function simulatedClick(elementId: string): number {
    return page.evaluate(function (elementId) {
        let itemEnum = document.getElementById(elementId);
        if (itemEnum) itemEnum.click();
        else return -1;
    } as any, elementId);
}

/**
 *  pollView(0, function (a, b) {
 *    return {status: "200", data: {username: "test"}};
 *  }, (data: any) => {
 *    console.log("成功:", data.username);
 *  }, () => {
 *    console.log("失败");
 *  }, "1", "10");
 *
 * @param tag
 * @param count
 * @param fun
 * @param success
 * @param fail
 * @param art
 */
function pollView(tag: string, count: number, fun: Function, success: Function, fail: Function, ...art) {
    setTimeout(() => {
        let ret = fun(...art);
        if (count > RETRY_NUMBER) {
            fail(ret.data, ret);
            return;
        }
        if (ret.status === '200') {
            log(`${tag}，已获取到指定元素，重试次数：${count}`);
            success(ret.data);
        } else {
            ++count;
            log(`${tag}，未获取到指定元素，重试[${count}]`);
            pollView(tag, count, fun, success, fail, ...art);
        }
    }, RETRY_INTERVAL);
}

/** 获得 HTML BODY 的高度*/
function getScrollHeight(): Function {
    return () => {
        return document.getElementsByTagName('body')[0].scrollHeight;
    };
}

/** 设置 HTML BODY 的高度*/
function setScrollHeight() {
    let scrollHeight = page.evaluate(getScrollHeight());
    page.clipRect = {top: 0, left: 0, width: RENDER_WIDTH, height: scrollHeight};
}

/**
 * 减免天数
 * @param reDay 183的倍数，如果不减免就传0
 * @param start
 * @param end
 */
function getStartAndEndDate2(reDay: number, start: string, end: string): any {
    let r = {startDate: '', endDate: ''};
    let s = new Date(end);
    s.setDate(s.getDate() - (QUERY_MAX_DAYS * (reDay + 1) - 1));
    let sD = new Date(start);
    if (s.getTime() <= sD.getTime()) s = sD;

    let e = new Date(end);
    e.setDate(e.getDate() - (QUERY_MAX_DAYS * reDay));
    r.startDate = dataCompletion(s.getFullYear()) + dataCompletion(s.getMonth() + 1) + dataCompletion(s.getDate());
    r.endDate = dataCompletion(e.getFullYear()) + dataCompletion(e.getMonth() + 1) + dataCompletion(e.getDate());

    console.log("r: ", r.startDate, r.endDate);
    return r;
}

/**
 * 获取放款日期，传入一个日期，然后获取前后 5 天的区间
 * @date 传入一个时间，计算区间
 */
function getLoanDate(date: string) {
    let r = {startDate: '', endDate: ''};
    let s = new Date(date);
    s.setDate(s.getDate() - 5);
    let e = new Date(date);
    e.setDate(e.getDate() + 5);
    r.startDate = dataCompletion(s.getFullYear()) + dataCompletion(s.getMonth() + 1) + dataCompletion(s.getDate());
    r.endDate = dataCompletion(e.getFullYear()) + dataCompletion(e.getMonth() + 1) + dataCompletion(e.getDate());
    return r;
}

/**
 * 获取两个时间之间的天数
 * @param sDate1
 * @param sDate2
 */
function dateDiff(sDate1, sDate2) {
    // 起始时间与结束时间一样，返回固定1天
    if (sDate1 === sDate2) {
        return 1;
    }

    let oDate1, oDate2, iDays;
    oDate1 = new Date(sDate1);
    oDate2 = new Date(sDate2);
    // @ts-ignore
    iDays = parseInt(Math.abs(oDate1 - oDate2) / 1000 / 60 / 60 / 24);
    return iDays;
}

/** 个位数补0 */
function dataCompletion(data: number): string {
    if (Number(data) < 10) return '0' + data;
    return String(data);
}

/** 出现异常，退出程序 */
function exitProgram(isSuccess: boolean) {
    runEndDate = new Date().getTime();
    page.close();
    console.log(isSuccess ? `COMPLETE` : 'FAIL', `耗时：${(runEndDate - runStartDate) / 1000} 秒`);
    // @ts-ignore
    phantom.exit(0);
}

function jumpProgram() {
    runEndDate = new Date().getTime();
    page.close();
    console.log(`WARN`);
    // @ts-ignore
    phantom.exit(0);
}


function getOutputPath(fileName: string): string {
    return `${argvOutput}${argvContractNo}-银行流水/${fileName}`;
}

/** ------------------------------------ Logger ------------------------------------ */
/** 是否显示时间 */
let isShowDate: boolean = false;
/** 是否显示日志级别 */
let isShowLevel: boolean = true;

function log(...optionalParams: any) {
    console.log(buildConsole('INFO'), ...optionalParams);
}

function warn(...optionalParams: any) {
    console.warn(buildConsole('WARN'), ...optionalParams);
}

function error(...optionalParams: any) {
    console.error(buildConsole('ERROR'), ...optionalParams);
}

function buildConsole(levelStr: string) {
    let date = isShowDate ? __formatTimestamp(new Date()) : '';
    let level = isShowLevel ? levelStr : '';
    return date + level;
}

function __formatTimestamp(timestamp: Date) {
    let year = timestamp.getFullYear();
    let date = timestamp.getDate();
    let month = ('0' + (timestamp.getMonth() + 1)).slice(-2);
    let hrs = Number(timestamp.getHours());
    let mins = ('0' + timestamp.getMinutes()).slice(-2);
    let secs = ('0' + timestamp.getSeconds()).slice(-2);
    let milliseconds = ('00' + timestamp.getMilliseconds()).slice(-3);
    return year + '-' + month + '-' + date + ' ' + hrs + ':' + mins + ':' + secs + '.' + milliseconds;
}

function autoFilZero(num, n): string {
    return (Array(n).join("0") + num).slice(-n);
}
