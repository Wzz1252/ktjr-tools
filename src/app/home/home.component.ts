import {ChangeDetectorRef, Component, NgZone, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import MinShengEntity from "../entity/MinShengEntity";
import MinShengController from "./MinShengController";
import TextUtils from "../core/TextUtils";
import Logger from "../core/Logger";
import XLSX from 'node-xlsx';
import UUIDUtils from "../core/UUIDUtils";
import {MatSnackBar} from "@angular/material/snack-bar";

const fs = require("fs");

const TAG = "HomeComponent";

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
    public static WEB_WAIT_ITEM: string = "WEB_WAIT_ITEM";
    public static WEB_OUT_PUT: string = "WEB_OUT_PUT";
    public static WEB_YEARS: string = "WEB_YEARS";
    public static URL_THREAD_COUNT: string = "URL_THREAD_COUNT";
    public static WEB_THREAD_COUNT: string = "WEB_THREAD_COUNT";
    public static PDF_THREAD_COUNT: string = "PDF_THREAD_COUNT";

    public info = {
        webWaitTime: localStorage.getItem(HomeComponent.WEB_WAIT_ITEM) || "1500",
        webOutPut: localStorage.getItem(HomeComponent.WEB_OUT_PUT) || "output/",
        webYears: localStorage.getItem(HomeComponent.WEB_YEARS) || "2",

        urlThreadCount: localStorage.getItem(HomeComponent.URL_THREAD_COUNT) || "1",
        webThreadCount: localStorage.getItem(HomeComponent.WEB_THREAD_COUNT) || "2",
        pdfThreadCount: localStorage.getItem(HomeComponent.PDF_THREAD_COUNT) || "1",
    };

    public minShengList: Array<MinShengEntity> = new Array<MinShengEntity>();
    public isShow: boolean = false;
    public isRun: boolean = false;
    public filePath: string = "";

    private controller: MinShengController = null;

    constructor(public router: Router,
                public ref: ChangeDetectorRef,
                public snackBar: MatSnackBar,
                public zone: NgZone) {
    }

    public ngOnInit(): void {
    }

    public onKeyUpWebWaitTime() {
        localStorage.setItem(HomeComponent.WEB_WAIT_ITEM, this.info.webWaitTime);
    }

    public onKeyUpWebOutPut() {
        localStorage.setItem(HomeComponent.WEB_OUT_PUT, this.info.webOutPut);
    }

    public onKeyUpWebYears() {
        localStorage.setItem(HomeComponent.WEB_YEARS, this.info.webYears);
    }

    public onKeyUpUrlThreadCount() {
        localStorage.setItem(HomeComponent.URL_THREAD_COUNT, this.info.urlThreadCount);
    }

    public onKeyUpWebThreadCount() {
        localStorage.setItem(HomeComponent.WEB_THREAD_COUNT, this.info.webThreadCount);
    }

    public onKeyUpPdfThreadCount() {
        localStorage.setItem(HomeComponent.PDF_THREAD_COUNT, this.info.pdfThreadCount);
    }

    public onChangeFile(data: any) {
        this.filePath = data.target.files[0].path;
    }

    public onClickGetData(): void {
        if (TextUtils.isEmpty(this.filePath)) {
            this.openSnackBar("请先上传 Excel !");
            return;
        }
        if (TextUtils.isEmpty(this.info.webOutPut)) {
            this.openSnackBar("文件输出路径不能为空");
            return;
        }
        if (Number(this.info.urlThreadCount) < 1) {
            this.openSnackBar("URL 请求线程数至少设置 1 个");
            return;
        }
        if (Number(this.info.webThreadCount) < 1) {
            this.openSnackBar("WEB 解析线程数至少设置 1 个");
            return;
        }
        if (Number(this.info.urlThreadCount) < 1) {
            this.openSnackBar("PDF 生成线程数至少设置 1 个");
            return;
        }

        this.controller = this.createQueueTask();
        this.minShengList = this.controller.getMinShengBackXlsx();
    }

    public onClickParseExcel(): void {
        if (TextUtils.isEmpty(this.filePath)) {
            this.openSnackBar("请先上传 Excel !");
            return;
        }

        if (this.isRun) {
            this.controller.stop();
            this.isRun = false;
        } else {
            this.controller.start();
            this.isRun = true;
        }
    }

    public onClickCreateLogger(): void {
        if (TextUtils.isEmpty(this.filePath)) {
            this.openSnackBar("请先上传 Excel !");
            return;
        }

        let logPath = this.info.webOutPut + "log/";

        let xlsxObj = [{
            name: '默认',
            data: [["进件号", "URL状态", "WEB状态", "PDF状态"]],
        }]

        for (let i = 0; i < this.minShengList.length; i++) {
            let item: MinShengEntity = this.minShengList[i] || new MinShengEntity();
            xlsxObj[0].data.push([item.contractNo, item.youxinStatus, item.webStatus, item.pdfStatus]);
        }

        this.mkdirRecursive(logPath, () => {
            this.writeFile(logPath + 'log-' + this.formatTimestamp(new Date()) + '.xlsx', xlsxObj);
        });

        this.openSnackBar("文件生成成功");
    }

    private openSnackBar(message: string): void {
        this.snackBar.open(message, '关闭', {duration: 3000});
    }

    private createQueueTask(): MinShengController {
        let controller = new MinShengController();
        controller.setExcelPath(this.filePath);
        controller.setOutput(this.info.webOutPut);
        controller.setWaitTime(this.info.webWaitTime);
        controller.setUrlThreadCount(this.info.urlThreadCount);
        controller.setWebThreadCount(this.info.webThreadCount);
        controller.setPdfThreadCount(this.info.pdfThreadCount);

        controller.setYouxinCallback((status: any, data: MinShengEntity) => {
            this.zone.run(() => data.youxinStatus = status);
        });
        controller.setWebCallback((status: any, data: MinShengEntity) => {
            this.zone.run(() => data.webStatus = status);
        });
        controller.setPdfCallback((status: any, data: MinShengEntity) => {
            this.zone.run(() => data.pdfStatus = status);
        });
        controller.setFailCallback(((code: string, errMsg: string) => {
            alert(errMsg);
        }))

        return controller;
    }

    /**
     * 创建多级目录
     * @param path 创建的目录
     * @param success
     */
    private mkdirRecursive(path: string, success: Function): void {
        fs.mkdir(path, {recursive: true}, (err) => {
            if (err) {
                Logger.log(TAG, "目录创建失败");
                return;
            }
            if (success) {
                success();
            }
        });
    }

    /**
     * 将内容写入文件
     * @param output 文件地址
     * @param dataUri 文件内容
     */
    private writeFile(output: string, xlsxObj: any): void {
        // @ts-ignore
        fs.writeFile(output, XLSX.build(xlsxObj), "binary",
            (error) => {
                if (error) {
                    Logger.log(TAG, "文件写入失败");
                    return;
                }
            });
    }

    private formatTimestamp(timestamp: Date) {
        let year = timestamp.getFullYear();
        let date = timestamp.getDate();
        let month = ('0' + (timestamp.getMonth() + 1)).slice(-2);
        let hrs = Number(timestamp.getHours());
        let mins = ('0' + timestamp.getMinutes()).slice(-2);
        let secs = ('0' + timestamp.getSeconds()).slice(-2);
        let milliseconds = ('00' + timestamp.getMilliseconds()).slice(-3);
        return year + '-' + month + '-' + date + ' ' + hrs + ':' + mins + ':' + secs + ':' + milliseconds;
    }

}
