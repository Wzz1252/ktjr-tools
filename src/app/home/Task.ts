import {TaskStatusEnum} from "./TaskStatusEnum";
import EnvPathManager from "../core/env.path.manager";
import axios from 'axios';

const exec = require('child_process').exec;

export default class Task {
    public status: TaskStatusEnum = TaskStatusEnum.WAIT;
    private tag = "";
    private testTime: number = 2000;
    private command: string = "";
    private webOutPut: string = "";
    private webWaitTime: string = "";
    private data: any = {};

    private taskStartListener?: Function = null;
    private taskSuccessListener?: Function = null;
    private taskFailListener?: Function = null;
    private taskJumpListener?: Function = null;

    private appExec?: any = null;
    private isKill: boolean = false;

    constructor(command: string, index: string, data: any, webOutPut: string, webWaitTime: string) {
        this.command = command;
        this.tag = index;
        this.data = data;
        this.webOutPut = webOutPut;
        this.webWaitTime = webWaitTime;
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
        this.runExec(this.command);
    }

    public kill(): void {
        if (this.getStatus() === TaskStatusEnum.RUNNING) {
            this.isKill = true;
            if (this.appExec) {
                this.appExec.kill();
            }
            this.setStatus(TaskStatusEnum.ERROR);
            if (this.taskFailListener) {
                this.taskFailListener(this.getTag(), "");
            }
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

    private runExec(command: any) {
        this.isKill = false;
        this.setStatus(TaskStatusEnum.RUNNING);
        if (this.taskStartListener) {
            this.taskStartListener(this.getTag());
        }
        this.requestAxios(() => {
            if (this.isKill) return;

            // console.log("成功执行了？");
            setTimeout(() => {
                this.command = this.getReturnCommand(this.data);
                this.runExecCommand(this.command);
            }, 100);
        }, (errorCode: string) => {
            // console.log("失败执行了？");
            this.setStatus(TaskStatusEnum.ERROR);
            if (this.taskFailListener) {
                this.taskFailListener(this.getTag(), errorCode);
            }
        }, this.data);
    }

    private requestAxios(success: Function, fail: Function, data: any) {
        if (data.url) {
            // console.log("url 已获得，直接开始解析");
            success();
            return;
        }
        if (this.isKill) {
            // console.log("程序被杀死了？");
            fail("");
            return;
        }
        setTimeout(() => {
            axios({
                url: "https://data-sharing.renrendai.com/cmbc/accountUrlList",
                method: "POST",
                data: `account=${JSON.stringify([{
                    fundAcc: this.data.assetId,
                    idNo: this.data.id
                }])}`,
                headers: {"Content-Type": "application/x-www-form-urlencoded"}
            }).then((response) => {
                if (this.isKill) return;

                if (response.data.data.length <= 0) {
                    fail("NULL");
                    return;
                }
                this.data.url = response.data.data[0].url;
                success();
                return;
            }).catch((error) => {
                if (this.isKill) return;

                let status = "";
                if (error.response) {
                    if(String(error.response.status) === "404") {
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

    private runExecCommand(command: string): void {
        console.log("命令: ", command);
        this.appExec = exec(command, (error, stdout, stderr) => {
            if (this.isKill) {
                return;
            }
            console.log("stdout:", stdout);
            console.log("stderr:", stderr);
            if (stdout.indexOf("COMPLETE") != -1) {
                this.setStatus(TaskStatusEnum.SUCCESS);
                if (this.taskSuccessListener) {
                    this.taskSuccessListener(this.getTag());
                }
            } else if (stdout.indexOf("WARN") !== -1) {
                // console.log("解析失败，任务退出");
                this.setStatus(TaskStatusEnum.WARN);
                if (this.taskJumpListener) {
                    this.taskJumpListener(this.getTag());
                }
            } else {
                if (this.isKill) {
                    // console.log("解析失败，任务退出");
                    this.setStatus(TaskStatusEnum.ERROR);
                    if (this.taskFailListener) {
                        this.taskFailListener(this.getTag(), "");
                    }
                } else {
                    // console.log("解析失败，重试");
                    this.runExec(command);
                }
            }
        });
    }

    public getReturnCommand(data: any): string {
        return EnvPathManager.getPhantomjsPath() + " " +
            EnvPathManager.getPjs() + " " +
            data.url + " " +
            this.webOutPut + " " +
            this.webWaitTime + " " +
            data.loanDate + " " +           // LoanDate
            data.startAdvanceDate + " " +   // StartAdvanceDate
            data.endAdvanceDate + " " +     // EndAdvanceDate
            data.productCode + " " +        // ProductCode
            data.contractNo + " ";          // ContractNo
    }

}
