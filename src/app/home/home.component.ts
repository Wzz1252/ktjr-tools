import {ChangeDetectorRef, Component, NgZone, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import MinShengEntity from "../entity/MinShengEntity";
import MinShengController from "./MinShengController";
import TextUtils from "../core/TextUtils";

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
                private zone: NgZone) {
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
            alert("请先上传 Excel !");
            return;
        }
        if (TextUtils.isEmpty(this.info.webOutPut)) {
            alert("文件输出路径不能为空");
            return;
        }
        if (Number(this.info.urlThreadCount) < 1) {
            alert("接口请求线程数至少设置 1 个");
            return;
        }
        if (Number(this.info.webThreadCount) < 1) {
            alert("Web解析线程数至少设置 1 个");
            return;
        }
        if (Number(this.info.urlThreadCount) < 1) {
            alert("PDF生成线程数至少设置 1 个");
            return;
        }

        this.controller = this.createQueueTask();
        this.minShengList = this.controller.getMinShengBackXlsx();
    }

    public onClickParseExcel(): void {
        if (this.isRun) {
            this.controller.stop();
            this.isRun = false;
        } else {
            this.controller.start();
            this.isRun = true;
        }
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

    public ngOnInit(): void {
    }
}
