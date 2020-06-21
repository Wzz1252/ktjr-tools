import {TaskStatusEnum} from "./TaskStatusEnum";
import EnvPathManager from "../core/env.path.manager";
import axios from 'axios';
import MinShengEntity from "../entity/MinShengEntity";

const exec = require('child_process').exec;

export default class MinShengTask {
    public status: TaskStatusEnum = TaskStatusEnum.WAIT;
    /** 请求地址 */
    private url: string = "https://data-sharing.renrendai.com/cmbc/accountUrlList";
    /** 用户标记 */
    private tag = "";
    /** 携带的原始数据 */
    private readonly data: MinShengEntity = new MinShengEntity();

    private taskStartListener?: Function = null;
    private taskSuccessListener?: Function = null;
    private taskFailListener?: Function = null;
    private taskJumpListener?: Function = null;

    /** 执行的任务 */
    private appExec?: any = null;
    private isKill: boolean = false;

    constructor(index: string, data: MinShengEntity) {
        this.tag = index;
        this.data = data;
    }

    public setStatus(status: TaskStatusEnum): void {
        this.status = status;
    }

    public getStatus(): TaskStatusEnum {
        return this.status;
    }

    public setTag(tag): void {
        this.tag = tag;
    }

    public getTag(): string {
        return this.tag;
    }

    public run(): void {
        this.runExec();
    }

    public kill(): void {
        if (this.getStatus() === TaskStatusEnum.RUNNING) {
            this.isKill = true;
            if (this.appExec) {
                this.appExec.kill();
            }
            this.taskFail("");
        }
    }

    public setTaskSuccessListener(listener: Function): void {
        this.taskSuccessListener = listener;
    }

    public setTaskFailListener(listener: Function): void {
        this.taskFailListener = listener;
    }

    public setTaskStartListener(listener: Function): void {
        this.taskStartListener = listener;
    }

    public setTaskJumpListener(listener: Function): void {
        this.taskJumpListener = listener;
    }

    private runExec() {
        this.isKill = false;
        this.setStatus(TaskStatusEnum.RUNNING);
        if (this.taskStartListener) {
            this.taskStartListener(this.getTag());
        }
        this.requestAxios(() => {
            if (this.isKillTask()) return;

            // console.log("成功执行了？");
            setTimeout(() => {
                this.runExecCommand(this.getReturnCommand(this.data));
            }, 100);
        }, (errorCode: string) => {
            this.taskFail(errorCode);
        }, this.data);
    }

    private requestAxios(success: Function, fail: Function, data: any) {
        if (data.url) {
            // console.log("url 已获得，直接开始解析");
            success();
            return;
        }
        if (this.isKillTask()) {
            // console.log("程序被杀死了？");
            fail("");
            return;
        }
        setTimeout(() => {
            axios({
                url: this.url, method: "POST",
                data: `account=${JSON.stringify([{
                    fundAcc: this.data.assetId,
                    idNo: this.data.id
                }])}`,
                headers: {"Content-Type": "application/x-www-form-urlencoded"}
            }).then((response) => {
                if (this.isKillTask()) return;
                if (response.data.data.length <= 0) {
                    fail("NULL");
                    return;
                }
                this.data.url = response.data.data[0].url;
                success();
                return;
            }).catch((error) => {
                if (this.isKillTask()) return;
                let status = "";
                if (error.response) {
                    // 仅仅捕获 404，如果有其他问题再进行捕获
                    if (String(error.response.status) === "404") {
                        status = String(error.response.status);
                        fail(status);
                        return;
                    } else {
                        this.requestAxios(success, fail, data);
                    }
                } else {
                    status = "UNKNOWN";
                    fail(status);
                    console.log('未捕获的异常信息', error.message);
                }
            });
        }, 1000);
    }

    /**
     * 根据命令行执行命令
     * @param command 命令行
     */
    private runExecCommand(command: string): void {
        console.log("命令: ", command);
        this.appExec = exec(command, (error, stdout, stderr) => {
            if (this.isKillTask()) {
                return;
            }
            console.log("stdout:", stdout);
            console.log("stderr:", stderr);
            if (stdout.indexOf("COMPLETE") != -1) {
                this.taskSuccess();
            } else if (stdout.indexOf("WARN") !== -1) {
                this.taskWarn();
            } else {
                if (this.isKillTask()) {
                    this.taskFail("");
                } else {
                    this.runExec();
                }
            }
        });
    }

    private taskSuccess(): void {
        this.setStatus(TaskStatusEnum.SUCCESS);
        if (this.taskSuccessListener) {
            this.taskSuccessListener(this.getTag());
        }
    }

    private taskWarn(): void {
        this.setStatus(TaskStatusEnum.WARN);
        if (this.taskJumpListener) {
            this.taskJumpListener(this.getTag());
        }
    }

    private taskFail(errorMessage: string): void {
        this.setStatus(TaskStatusEnum.ERROR);
        if (this.taskFailListener) {
            this.taskFailListener(this.getTag(), errorMessage);
        }
    }

    /**
     * 任务是否已经结束
     * @return true 结束、false 未结束
     */
    private isKillTask(): boolean {
        return this.isKill;
    }

    public getReturnCommand(data: MinShengEntity): string {
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
