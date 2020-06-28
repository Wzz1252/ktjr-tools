import MinShengEntity from "../entity/MinShengEntity";
import XLSX from 'node-xlsx';
import QueueTask from "../core/queue/QueueTask";
import NewTask from "../core/task/NewTask";
import YouXinImplTask from "../core/task/YouXinImplTask";
import TaskCallbackListener from "../core/queue/TaskCallbackListener";
import MinShengWebTask from "../core/task/MinShengWebTask";
import PDFTask from "../core/task/PDFTask";
import Logger from "../core/Logger";
import TextUtils from "../core/TextUtils";

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

    private fileCallback: (code: string, errMsg: string) => void;

    public excelPath: string = "";
    public output: string = "";
    public waitTime: string = "";

    public isRunning: boolean = false;

    constructor() {
        this.youxinQueue = new QueueTask<MinShengEntity, NewTask<MinShengEntity>>("URL");
        this.webQueue = new QueueTask<MinShengEntity, NewTask<MinShengEntity>>("WEB");
        this.pdfQueue = new QueueTask<MinShengEntity, NewTask<MinShengEntity>>("PDF");
        this.setListener();
    }

    public start(): void {
        if (this.minShengList.length <= 0) {
            this.minShengList = this.getMinShengBackXlsx();
        }

        if (this.youxinQueue.getCacheQueueCount() === 0) {
            for (let i = 0; i < this.minShengList.length; i++) {
                let task = new YouXinImplTask(this.minShengList[i]);
                this.youxinQueue.addTask(task);
            }
        }

        this.isRunning = true;

        this.youxinQueue.startServe();
        this.webQueue.startServe();
        this.pdfQueue.startServe();

        // this.youxinQueue.startTask();
        // this.webQueue.startTask();
        // this.pdfQueue.startTask();
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

    /**
     * 解析民生银行 Excel 文件
     */
    public getMinShengBackXlsx(): Array<MinShengEntity> {
        let xList: Array<MinShengEntity> = new Array<MinShengEntity>();

        if (TextUtils.isEmpty(this.excelPath)) {
            this.eventFail("-1", "Excel 文件路径不能为空");
            return xList;
        }

        const workSheetsFromFile = XLSX.parse(this.excelPath);
        const item = workSheetsFromFile[0].data || [];
        if (item.length <= 0) {
            this.eventFail("-1", "Excel 内容不能为空");
            return xList;
        }

        function setValue(entity: MinShengEntity, value: string, key: string): boolean {
            if (TextUtils.isEmpty(key)) {
                return false;
            }
            entity[value] = key;
            return true;
        }

        // 从 1 开始，忽略顶部的标签
        for (let i = 1; i < item.length; i++) {
            let entity = new MinShengEntity();
            entity.index = (i - 1);
            if (!setValue(entity, "id", item[i][0])) {
                this.eventFail("-1", "Excel 第 " + i + " 行【身份证号码】不能为空");
                return [];
            }
            if (!setValue(entity, "loanDate", item[i][1])) {
                this.eventFail("-1", "Excel 第 " + (i + 1) + " 行【放款时间】不能为空");
                return [];
            }
            if (!setValue(entity, "startAdvanceDate", item[i][2])) {
                this.eventFail("-1", "Excel 第 " + (i + 1) + " 行【首次垫付时间】不能为空");
                return [];
            }
            if (!setValue(entity, "endAdvanceDate", item[i][3])) {
                this.eventFail("-1", "Excel 第 " + (i + 1) + " 行【末次垫付时间】不能为空");
                return [];
            }
            if (!setValue(entity, "productCode", item[i][4])) {
                this.eventFail("-1", "Excel 第 " + (i + 1) + " 行【理财端借款标的ID】不能为空");
                return [];
            }
            if (!setValue(entity, "contractNo", item[i][5])) {
                this.eventFail("-1", "Excel 第 " + (i + 1) + " 行【进件号】不能为空");
                return [];
            }
            if (!setValue(entity, "assetId", item[i][6])) {
                this.eventFail("-1", "Excel 第 " + (i + 1) + " 行【存管账户号】不能为空");
                return [];
            }
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

    public setFailCallback(failCallback: (code: string, errMsg: string) => void): void {
        this.fileCallback = failCallback;
    }

    private setListener(): void {
        this.youxinQueue.setSuccessListener((data: MinShengEntity) => {
            let task = new MinShengWebTask(this.minShengList[data.index]);
            this.webQueue.addTask(task)
        });
        this.youxinQueue.setCallback(((statue: any, data: MinShengEntity) => {
            if (this.youxinCallback) this.youxinCallback(statue, data);
        }));

        this.webQueue.setSuccessListener((data: MinShengEntity) => {
            let task = new PDFTask(this.minShengList[data.index]);
            this.pdfQueue.addTask(task)
        });
        this.webQueue.setCallback(((statue: any, data: MinShengEntity) => {
            if (this.webCallback) this.webCallback(statue, data);
        }));

        this.pdfQueue.setCallback(((statue: any, data: MinShengEntity) => {
            if (this.pdfCallback) this.pdfCallback(statue, data);
        }));
    }

    private eventFail(code: string, errMsg: string) {
        if (this.fileCallback) {
            this.fileCallback(code, errMsg);
        }
    }
}
