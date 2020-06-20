import {Component, OnInit, ChangeDetectorRef, NgZone} from '@angular/core';
import {Router} from '@angular/router';
import xlsx from 'node-xlsx';
import QueueTask from "./QueueTask";
import Task from "./Task";
import jsPDF from 'jspdf';
import PDFManager from "./PDFManager";

const fs = require("fs");

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
    public errorCode: string = "1";
    public xlsxList: any[] = [];
    public filePath = "";
    public queueTask: QueueTask = null;
    public isRun: boolean = false;
    public cursor: number = 0;

    constructor(public router: Router, public ref: ChangeDetectorRef, private zone: NgZone) {
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

        console.log("完成: ", this.xlsxList);
        this.queueTask = new QueueTask();
        this.queueTask.setTaskNumber(Number(this.evaluateInfo.taskNum));
        for (let i = 0; i < this.xlsxList.length; i++) {
            this.queueTask.addTask(
                new Task(this.xlsxList[i].command,
                    String(this.xlsxList[i].index),
                    this.xlsxList[i],
                    this.evaluateInfo.webOutPut,
                    this.evaluateInfo.webWaitTime
                ));
        }
        this.queueTask.setCompleteListener(() => {
            this.zone.run(() => this.isRun = false);
            alert("解析完成！");
        });
        this.queueTask.setSuccessListener((index) => this.zone.run(() => this.xlsxList[index].status = "SUCCESS"));
        this.queueTask.setFailListener((index, errorCode) => this.zone.run(() => {
            this.xlsxList[index].status = "FAIL";
            this.xlsxList[index].errorCode = errorCode;
        }));
        this.queueTask.setStartListener((index) => this.zone.run(() => this.xlsxList[index].status = "LOADING"));
        this.queueTask.setJumpListener((index) => this.zone.run(() => this.xlsxList[index].status = "WARN"));
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

    public onClickPdf(): void {
        // let pdfManager = new PDFManager();
        // let files = [];
        // pdfManager.readFileList("/Users/torment/output3/1466229-银行流水/", files);
        // console.log("结果：", files);
        //
        // var doc = new jsPDF();
        // // 获得本地图片
        // let nativeImage = "";
        // fs.readFile('/Users/torment/output3/1466229-银行流水/1466229-1账号.png',
        //     (err, data) => {
        //         nativeImage = data;
        //
        //         for (let i = 1; i < 100; i++) {
        //             doc.addImage(data, 'PNG', 0, 20, 200, 200);
        //             doc.addPage();
        //         }
        //         console.log("获得本地图片：", err, data);
        //
        //         let datauri = doc.output("arraybuffer");
        //         // @ts-ignore
        //         fs.writeFile('/Users/torment/output3/pdf/xxx.pdf', new Buffer.from(datauri),
        //             function (error) {
        //                 console.log("写入结果: ", error);
        //             });
        //     });

        let pdf = new jsPDF('p', 'pt', 'a4', true);
        this.testAddFile("/Users/torment/output3/", pdf);
    }

    private async testAddFile(path: string, pdf: jsPDF) {
        let pdfManager = new PDFManager();
        let files = [];
        pdfManager.readFileList(path, files);
        console.log("结果：", files);

        for (let i = 0; i < files.length; i++) {
            let content = await this.readFile(files[i].path + files[i].filename);
            pdf.addPage([files[i].width, files[i].height]);
            pdf.addImage(content, "PNG", 0, 0, files[i].width, files[i].height, "", "MEDIUM");
            console.log(`index[${i}]: `, content);
        }
        console.log("执行完成...");
        let dataUri = pdf.output("arraybuffer");
        console.log("获得数据...");
        // @ts-ignore
        fs.writeFile('/Users/torment/xxx.pdf', new Buffer.from(dataUri),
            function (error) {
                console.log("写入结果: ", error);
            });
    }

    private readFile(pathName: string) {
        return new Promise((resolve, reject) => {
            fs.readFile(pathName,
                (error, data) => {
                    resolve(data);
                });
        });
    }

    /** 解析民生银行 */
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
                assetId: item[i][6] || "",          // 资产ID
                status: "WAIT",                     // 状态
                command: ""
            };
            xList.push(natItem);
        }
        return xList;
    }

    public ngOnInit(): void {
    }
}
