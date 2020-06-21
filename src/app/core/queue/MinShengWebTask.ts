import {NewTaskStatusEnum} from "./NewTaskStatusEnum";
import NewTask from "./NewTask";
import MinShengEntity from "../../entity/MinShengEntity";
import Logger from "./Logger";
import {MinShengStatusEnum} from "./MinShengStatusEnum";
import EnvPathManager from "../env.path.manager";

const exec = require('child_process').exec;

const TAG: string = "MinShengWebTask";

export default class MinShengWebTask extends NewTask<MinShengEntity> {
    private appExec?: any = null;

    constructor(data: MinShengEntity) {
        super();
        this.data = data;
    }

    public startTask(): void {
        super.startTask();
        Logger.log(TAG, "开启任务");
        this.status = NewTaskStatusEnum.RUNNING;
        this.data.webStatus = MinShengStatusEnum.RUNNING;
        this.eventStart(this.data);
        this.runExec();
    }

    public stopTask(): void {
        super.stopTask();
        if (this.appExec) {
            this.appExec.kill();
        }
    }

    private runExec() {
        setTimeout(() => {
            this.runExecCommand(this.getReturnCommand(this.data));
        }, 100);
    }

    private runExecCommand(command: string): void {
        console.log("命令: ", command);
        this.appExec = exec(command, (error, stdout, stderr) => {
            if (!this.isRunTask) {
                Logger.log(TAG, "任务已终止，请求解析数据");
                this.eventFail(this.data);
                return;
            }
            // console.log("stdout:", stdout);
            // console.log("stderr:", stderr);
            if (stdout.indexOf("COMPLETE") != -1) {
                console.log("任务执行完成：", this.data);
                this.data.webStatus = MinShengStatusEnum.SUCCESS;
                this.eventSuccess(this.data);
            } else if (stdout.indexOf("WARN") !== -1) {
                this.data.webStatus = MinShengStatusEnum.WARN;
                this.eventSuccess(this.data); // TODO WRAN
            } else {
                if (!this.isRunTask) {
                    this.data.webStatus = MinShengStatusEnum.ERROR;
                    this.eventFail(this.data);
                } else {
                    this.runExec();
                }
            }
        });
    }

    private getReturnCommand(data: MinShengEntity): string {
        return EnvPathManager.getPhantomjsPath() + " " +
            EnvPathManager.getPjs() + " " +
            data.url + " " +
            data.output + " " +
            data.waitTime + " " +
            data.loanDate + " " +           // LoanDate
            data.startAdvanceDate + " " +   // StartAdvanceDate
            data.endAdvanceDate + " " +     // EndAdvanceDate
            data.productCode + " " +        // ProductCode
            data.contractNo + " ";          // ContractNo
    }
}

