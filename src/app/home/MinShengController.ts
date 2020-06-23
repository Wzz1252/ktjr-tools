import MinShengEntity from "../entity/MinShengEntity";
import XLSX from 'node-xlsx';
import QueueTask from "../core/queue/QueueTask";
import NewTask from "../core/task/NewTask";
import YouXinImplTask from "../core/task/YouXinImplTask";
import TaskCallbackListener from "../core/queue/TaskCallbackListener";
import MinShengWebTask from "../core/task/MinShengWebTask";
import PDFTask from "../core/task/PDFTask";

const TAG = "MinShengController";
/**
 * 民生控制器
 */
export default class MinShengController {
    private youxinQueue: QueueTask<MinShengEntity, NewTask<MinShengEntity>> = null;
    private webQueue: QueueTask<MinShengEntity, NewTask<MinShengEntity>> = null;
    private pdfQueue: QueueTask<MinShengEntity, NewTask<MinShengEntity>> = null;

    private minShengList: Array<MinShengEntity> = new Array<MinShengEntity>();

    private youxinCallback: TaskCallbackListener<MinShengEntity>;
    private webCallback: TaskCallbackListener<MinShengEntity>;
    private pdfCallback: TaskCallbackListener<MinShengEntity>;

    public excelPath: string = "";
    public output: string = "";
    public waitTime: string = "";

    public isRunning: boolean = false;

    constructor() {
        this.youxinQueue = new QueueTask<MinShengEntity, NewTask<MinShengEntity>>();
        this.webQueue = new QueueTask<MinShengEntity, NewTask<MinShengEntity>>();
        this.pdfQueue = new QueueTask<MinShengEntity, NewTask<MinShengEntity>>();
        this.setListener();
    }

    public start(): void {
        if (this.minShengList.length <= 0) {
            this.minShengList = this.getMinShengBackXlsx();
        }

        if (this.youxinQueue.getCacheQueueSize() === 0) {
            for (let i = 0; i < this.minShengList.length; i++) {
                let task = new YouXinImplTask(this.minShengList[i]);
                this.youxinQueue.addTask2(task);
            }
        }

        this.isRunning = true;
        this.youxinQueue.startTask();
        this.webQueue.startTask();
        this.pdfQueue.startTask();
    }

    public stop(): void {
        this.isRunning = true;
        if (this.youxinQueue) {
            this.youxinQueue.stopTask();
        }
        if (this.webQueue) {
            this.webQueue.stopTask();
        }
        if (this.pdfQueue) {
            this.pdfQueue.stopTask();
        }
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

    public setUrlThreadCount(count: string): void {
        if (this.youxinQueue) {
            this.youxinQueue.setThreadCount(Number(count));
        }
    }

    public setWebThreadCount(count: string): void {
        if (this.webQueue) {
            this.webQueue.setThreadCount(Number(count));
        }
    }

    public setPdfThreadCount(count: string): void {
        if (this.pdfQueue) {
            this.pdfQueue.setThreadCount(Number(count));
        }
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

    public setYouxinCallback(callback: TaskCallbackListener<MinShengEntity>): void {
        this.youxinCallback = callback;
    }

    public setWebCallback(callback: TaskCallbackListener<MinShengEntity>): void {
        this.webCallback = callback;
    }

    public setPdfCallback(callback: TaskCallbackListener<MinShengEntity>): void {
        this.pdfCallback = callback;
    }

    private setListener(): void {
        if (this.youxinQueue) {
            this.youxinQueue.setSuccessListener((data: MinShengEntity) => {
                let task = new MinShengWebTask(this.minShengList[data.index]);
                this.webQueue.addTask2(task)
            });
            this.youxinQueue.setCallback(((statue: any, data: MinShengEntity) => {
                if (this.youxinCallback) this.youxinCallback(statue, data);
            }));
        }
        if (this.webQueue) {
            this.webQueue.setSuccessListener((data: MinShengEntity) => {
                let task = new PDFTask(this.minShengList[data.index]);
                this.pdfQueue.addTask2(task)
            });
            this.webQueue.setCallback(((statue: any, data: MinShengEntity) => {
                if (this.webCallback) this.webCallback(statue, data);
            }));
        }
        if (this.pdfQueue) {
            this.pdfQueue.setCallback(((statue: any, data: MinShengEntity) => {
                if (this.pdfCallback) this.pdfCallback(statue, data);
            }));
        }
    }
}
