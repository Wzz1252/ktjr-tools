import MinShengEntity from "../../entity/MinShengEntity";
import XLSX from 'node-xlsx';
import NewQueueTask from "./NewQueueTask";
import NewTask from "./NewTask";
import YouXinImplTask from "./YouXinImplTask";
import {TaskFailListener, TaskStartListener, TaskSuccessListener} from "./TaskSuccessListener";
import MinShengWebTask from "./MinShengWebTask";
import Logger from "./Logger";

const TAG = "MinShengController";
/**
 * 民生控制器
 */
export default class MinShengController {
    private youxinQueue: NewQueueTask<MinShengEntity, NewTask<MinShengEntity>> = null;
    private webQueue: NewQueueTask<MinShengEntity, NewTask<MinShengEntity>> = null;
    private pdfQueue: NewQueueTask<MinShengEntity, NewTask<MinShengEntity>> = null;

    private minShengList: Array<MinShengEntity> = new Array<MinShengEntity>();

    public excelPath: string = "";
    public output: string = "";
    public waitTime: string = "";
    public threadCount: string = "";

    private youxinStart: TaskStartListener<MinShengEntity>;
    private youxinSuccess: TaskSuccessListener<MinShengEntity>;
    private youxinFail: TaskFailListener<MinShengEntity>;

    private webStart: TaskStartListener<MinShengEntity>;
    private webSuccess: TaskSuccessListener<MinShengEntity>;
    private webFail: TaskFailListener<MinShengEntity>;

    private pdfStart: TaskStartListener<MinShengEntity>;
    private pdfSuccess: TaskSuccessListener<MinShengEntity>;
    private pdfFail: TaskFailListener<MinShengEntity>;

    constructor() {
        this.youxinQueue = new NewQueueTask<MinShengEntity, NewTask<MinShengEntity>>();
        this.webQueue = new NewQueueTask<MinShengEntity, NewTask<MinShengEntity>>();
        this.pdfQueue = new NewQueueTask<MinShengEntity, NewTask<MinShengEntity>>();
        this.setListener();
    }

    public start(): void {
        if (this.minShengList.length <= 0) {
            this.minShengList = this.getMinShengBackXlsx();
        }

        for (let i = 0; i < Number(this.threadCount); i++) {
            let task = new YouXinImplTask(this.minShengList[i]);
            this.youxinQueue.addTask2(task);
        }
        this.youxinQueue.startTask();
    }

    public setExcelPath(path: string): void {
        this.excelPath = path;
    }

    public setOutput(output: string): void {
        this.output = output;
    }

    public setWaitTime(waitTime: string): void {
        this.waitTime = waitTime;
    }

    public setThreadCount(count: string): void {
        this.threadCount = count;
    }

    /** 解析民生银行 */
    public getMinShengBackXlsx(): Array<MinShengEntity> {
        const workSheetsFromFile = XLSX.parse(this.excelPath);
        let xList: Array<MinShengEntity> = new Array<MinShengEntity>();
        let item = workSheetsFromFile[0].data;
        for (let i = 1; i < item.length; i++) {
            let entity = new MinShengEntity();
            entity.index = (i - 1);
            entity.id = item[i][0] || "";
            entity.loanDate = item[i][1] || "";
            entity.startAdvanceDate = item[i][2] || "";
            entity.endAdvanceDate = item[i][3] || "";
            entity.productCode = item[i][4] || "";
            entity.contractNo = item[i][5] || "";
            entity.assetId = item[i][6] || "";
            entity.status = "WAIT";
            entity.output = this.output;
            entity.waitTime = this.waitTime;
            xList.push(entity);
        }
        this.minShengList = xList;
        return xList;
    }

    public setYouxinStartListener(listener: TaskStartListener<MinShengEntity>): void {
        this.youxinStart = listener;
    }

    public setYouxinSuccessListener(listener: TaskSuccessListener<MinShengEntity>): void {
        this.youxinSuccess = listener;
    }


    public setYouxinFailListener(listener: TaskFailListener<MinShengEntity>): void {
        this.youxinFail = listener;
    }

    public setWebStartListener(listener: TaskStartListener<MinShengEntity>): void {
        this.webStart = listener;
    }

    public setWebSuccessListener(listener: TaskSuccessListener<MinShengEntity>): void {
        this.webSuccess = listener;
    }

    public setWebFailListener(listener: TaskFailListener<MinShengEntity>): void {
        this.webFail = listener;
    }

    public setPdfStartListener(listener: TaskStartListener<MinShengEntity>): void {
        this.pdfStart = listener;
    }

    public setPdfSuccessListener(listener: TaskSuccessListener<MinShengEntity>): void {
        this.pdfSuccess = listener;
    }

    public setPdfFailListener(listener: TaskFailListener<MinShengEntity>): void {
        this.pdfFail = listener;
    }

    private taskCount: number = 0;

    private setListener(): void {
        if (this.youxinQueue) {
            this.youxinQueue.setStartListener((data: MinShengEntity) => {
                if (this.youxinStart) {
                    this.youxinStart(data);
                }
            });
            this.youxinQueue.setSuccessListener((data: MinShengEntity) => {
                this.taskCount++;
                Logger.log(TAG, "友信执行成功：", this.taskCount, data.index);
                if (this.youxinSuccess) {
                    this.youxinSuccess(data);
                }
                let task = new MinShengWebTask(this.minShengList[data.index]);
                this.webQueue.addTask2(task)
                this.webQueue.startTask();
            });
            this.youxinQueue.setFailListener((data: MinShengEntity) => {
                if (this.youxinFail) this.youxinFail(data);
            });
        }

        if (this.webQueue) {
            this.webQueue.setStartListener((data: MinShengEntity) => {
                if (this.webStart) {
                    this.webStart(data);
                }
            });
            this.webQueue.setSuccessListener((data: MinShengEntity) => {
                Logger.log(TAG, "民生网页执行成功：", this.taskCount, data.index);
                if (this.webSuccess) this.webSuccess(data);
                let task = new YouXinImplTask(this.minShengList[this.taskCount]);
                this.youxinQueue.addTask2(task);
            });
            this.webQueue.setFailListener((data: MinShengEntity) => {
                if (this.webFail) this.webFail(data);
            });
        }

        if (this.pdfQueue) {
            this.pdfQueue.setStartListener((data: MinShengEntity) => {
                if (this.pdfStart) {
                    this.pdfStart(data);
                }
            });
            this.pdfQueue.setSuccessListener((data: MinShengEntity) => {
                if (this.pdfSuccess) this.pdfSuccess(data);
            });
            this.pdfQueue.setFailListener((data: MinShengEntity) => {
                if (this.pdfFail) this.pdfFail(data);
            });
        }
    }

}
