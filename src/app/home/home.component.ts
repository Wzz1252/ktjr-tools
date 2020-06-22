import {ChangeDetectorRef, Component, NgZone, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import QueueTask from "./QueueTask";
import MinShengEntity from "../entity/MinShengEntity";
import PDFManager from "./PDFManager";
import xlsx from 'node-xlsx';
import jsPDF from 'jspdf';
import MinShengController from "../core/queue/MinShengController";
import Logger from "../core/queue/Logger";

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
    public static TASK_NUM: string = "WEB_TASK";

    public info = {
        webWaitTime: localStorage.getItem(HomeComponent.WEB_WAIT_ITEM) || "1500",
        webOutPut: localStorage.getItem(HomeComponent.WEB_OUT_PUT) || "output/",
        webYears: localStorage.getItem(HomeComponent.WEB_YEARS) || "2",
        taskNum: localStorage.getItem(HomeComponent.TASK_NUM) || "2"
    };

    public isShow: boolean = false;
    public minShengList: Array<MinShengEntity> = new Array<MinShengEntity>();
    public filePath = "";
    public queueTask: QueueTask = null;
    public isRun: boolean = false;
    public cursor: number = 0;

    constructor(public router: Router, public ref: ChangeDetectorRef, private zone: NgZone) {
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

    public onKeyUpTaskNum() {
        localStorage.setItem(HomeComponent.TASK_NUM, this.info.taskNum);
    }

    public onChangeFile(data: any) {
        this.filePath = data.target.files[0].path;
    }

    public onClickGetData(): void {
        if (this.filePath === "") {
            alert("请先上传 Excel !");
            return;
        }
        this.createQueueTask();
    }

    public onClickParseExcel(): void {
        if (this.isRun) {
            this.minShengController.stop();
            this.isRun = false;
        } else {
            this.minShengController.start();
            this.isRun = true;
        }
    }

    private minShengController: MinShengController = null;

    private createQueueTask(): void {
        this.minShengController = new MinShengController();
        this.minShengController.setExcelPath(this.filePath);
        this.minShengController.setOutput(this.info.webOutPut);
        this.minShengController.setWaitTime(this.info.webWaitTime);
        this.minShengController.setThreadCount(this.info.taskNum);

        this.minShengController.setYouxinCallback((status: any, data: MinShengEntity) => {
            Logger.log(TAG, "友信 =+=+: ", status, data);
            this.zone.run(() => data.youxinStatus = status);
        });
        this.minShengController.setWebCallback((status: any, data: MinShengEntity) => {
            Logger.log(TAG, "民生 =+=+: ", status);
            this.zone.run(() => data.webStatus = status);
        });
        this.minShengController.setPdfCallback((status: any, data: MinShengEntity) => {
            Logger.log(TAG, "PDF =+=+: ", status);
            this.zone.run(() => data.pdfStatus = status);
        });

        this.minShengList = this.minShengController.getMinShengBackXlsx();
    }

    public ngOnInit(): void {
    }
}
