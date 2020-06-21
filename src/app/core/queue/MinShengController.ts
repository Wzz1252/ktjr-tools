import MinShengEntity from "../../entity/MinShengEntity";
import XLSX from 'node-xlsx';
import NewQueueTask from "./NewQueueTask";
import NewTask from "./NewTask";
import MinShengTask from "../../home/MinShengTask";
import YouXinImplTask from "./YouXinImplTask";
import Logger from "./Logger";
import {TaskFailListener, TaskSuccessListener} from "./TaskSuccessListener";

const TAG = "MinShengController";
/**
 * 民生控制器
 */
export default class MinShengController {
    private youxinQueue: NewQueueTask<MinShengEntity, NewTask<MinShengEntity>> = new NewQueueTask<MinShengEntity, NewTask<MinShengEntity>>();

    private minShengList: Array<MinShengEntity> = new Array<MinShengEntity>();

    public excelPath: string = "";
    public output: string = "";
    public waitTime: string = "";
    public threadCount: string = "";

    private youxinSuccess: TaskSuccessListener<MinShengEntity>;
    private youxinFail: TaskFailListener<MinShengEntity>;

    constructor() {
        this.youxinQueue = new NewQueueTask<MinShengEntity, NewTask<MinShengEntity>>();
        this.setListener();
    }

    public start(): void {
        if (this.minShengList.length <= 0) {
            this.minShengList = this.getMinShengBackXlsx();
        }
        for (let i = 0; i < this.minShengList.length; i++) {
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

    public setYouxinSuccessListener(listener: TaskSuccessListener<MinShengEntity>): void {
        this.youxinSuccess = listener;
    }

    public setYouxinFailListener(listener: TaskFailListener<MinShengEntity>): void {
        this.youxinFail = listener;
    }

    private setListener() :void {
        if(this.youxinQueue) {
            this.youxinQueue.setSuccessListener((data: MinShengEntity) => {
                if (this.youxinSuccess) this.youxinSuccess(data);
            });
            this.youxinQueue.setFailListener((data: MinShengEntity) => {
                if (this.youxinFail) this.youxinFail(data);
            });
        }
    }

}
