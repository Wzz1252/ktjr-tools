import {Component, OnInit, ChangeDetectorRef, NgZone} from '@angular/core';
import {Router} from '@angular/router';
import EnvPathManager from "../core/env.path.manager";
import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import xlsx from 'node-xlsx';
import QueueTask from "./QueueTask";
import Task from "./Task";
import {throwError} from "rxjs";
import {catchError} from "rxjs/operators";

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

    public evaluateInfo = {
        webWaitTime: localStorage.getItem(HomeComponent.WEB_WAIT_ITEM) || "1500",
        webOutPut: localStorage.getItem(HomeComponent.WEB_OUT_PUT) || "output/",
        webYears: localStorage.getItem(HomeComponent.WEB_YEARS) || "2",
        taskNum: localStorage.getItem(HomeComponent.TASK_NUM) || "2"
    };

    public isShow: boolean = false;
    public xlsxList: any[] = [];
    public filePath = "";
    public queueTask: QueueTask = null;
    public isRun: boolean = false;

    constructor(public router: Router,
                public ref: ChangeDetectorRef,
                private zone: NgZone,
                public http: HttpClient) {
    }

    public onKeyUpWebWaitTime() {
        localStorage.setItem(HomeComponent.WEB_WAIT_ITEM, this.evaluateInfo.webWaitTime);
    }

    public onKeyUpWebOutPut() {
        localStorage.setItem(HomeComponent.WEB_OUT_PUT, this.evaluateInfo.webOutPut);
    }

    public onKeyUpWebYears() {
        localStorage.setItem(HomeComponent.WEB_YEARS, this.evaluateInfo.webYears);
    }

    public onKeyUpTaskNum() {
        localStorage.setItem(HomeComponent.TASK_NUM, this.evaluateInfo.taskNum);
    }

    public fileChange(data: any) {
        this.filePath = data.target.files[0].path;
    }

    public onClickGetData(): void {
        if (this.filePath === "") {
            alert("请先上传 Excel !");
            return;
        }
        this.xlsxList = this.getMinShengBackXlsx(this.filePath);
        let urls = "";
        for (let i = 0; i < this.xlsxList.length; i++) {
            urls += this.xlsxList[i].id + ",";
        }
        this.requestPost(urls, () => {
            this.queueTask = new QueueTask();
            this.queueTask.setTaskNumber(Number(this.evaluateInfo.taskNum));
            for (let i = 0; i < this.xlsxList.length; i++) {
                this.queueTask.addTask(new Task(this.xlsxList[i].command, String(this.xlsxList[i].index)));
            }
            this.queueTask.setCompleteListener(() => {
                this.zone.run(() => this.isRun = false);
                alert("解析完成！");
            });
            this.queueTask.setSuccessListener((index) => this.zone.run(() => this.xlsxList[index].status = "SUCCESS"));
            this.queueTask.setFailListener((index) => this.zone.run(() => this.xlsxList[index].status = "FAIL"));
            this.queueTask.setStartListener((index) => this.zone.run(() => this.xlsxList[index].status = "LOADING"));
        });
    }

    public onClickParseExcel(): void {
        if (this.xlsxList.length <= 0) {
            alert("请先上传 Excel，然后点击获取数据");
            return;
        }
        if (this.isRun) {
            this.queueTask.stopAll();
            this.isRun = false;
        } else {
            this.queueTask.run();
            this.isRun = true;
        }
    }

    public onClickKill(): void {
        this.queueTask.stopAll();
    }

    // 解析民生银行
    private getMinShengBackXlsx(path: string): any[] {
        const workSheetsFromFile = xlsx.parse(path);
        let xList = [];
        for (let i = 1; i < workSheetsFromFile[0].data.length; i++) {
            let item = workSheetsFromFile[0].data;
            let natItem = {
                index: (i - 1),
                id: item[i][0] || "",               // 身份证号码
                loanDate: item[i][1] || "",         // 放款时间
                startAdvanceDate: item[i][2] || "", // 首次垫付时间
                endAdvanceDate: item[i][3] || "",   // 末次垫付时间
                productCode: item[i][4] || "",      // 理财端借款标的id
                contractNo: item[i][5] || "",       // 合同编号
                status: "WAIT",                     // 合同编号
                command: ""
            };
            xList.push(natItem);
        }
        return xList;
    }

    public requestPost(urls: string, callback: Function): void {
        let _this = this;
        this.zone.run(() => this.isShow = true);

        function handleError(error: HttpErrorResponse) {
            setTimeout(() => _this.zone.run(() => {
                _this.isShow = false;
                _this.xlsxList = [];
            }), 500);
            alert("请求出现错误，请重试。");
            return throwError('Something bad happened; please try again later.');
        }

        this.http.post("https://data-sharing.renrendai.com/cmbc/accountUrlList", null, {params: {idNo: urls}})
            .pipe(catchError(handleError))
            .subscribe((response: any) => {
                console.log(response.data);
                for (let i = 0; i < response.data.length; i++) {
                    for (let j = 0; j < this.xlsxList.length; j++) {
                        if (response.data[i].idNo === this.xlsxList[j].id) {
                            this.xlsxList[j].url = response.data[i].url;
                            this.xlsxList[j].command = this.getReturnCommand(this.xlsxList[j]);
                        }
                    }
                }
                this.zone.run(() => this.isShow = false);
                if (callback) callback();
            });
    }

    public getReturnCommand(data: any): string {
        return EnvPathManager.getPhantomjsPath() + " " +
            EnvPathManager.getPjs() + " " +
            data.url + " " +
            this.evaluateInfo.webOutPut + " " +
            this.evaluateInfo.webWaitTime + " " +
            data.loanDate + " " +           // LoanDate
            data.startAdvanceDate + " " +   // StartAdvanceDate
            data.endAdvanceDate + " " +     // EndAdvanceDate
            data.productCode + " " +        // ProductCode
            data.contractNo + " ";          // ContractNo
    }

    public ngOnInit(): void {
    }
}
