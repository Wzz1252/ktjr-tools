import {TaskStatusEnum} from "./TaskStatusEnum";
import EnvPathManager from "../core/env.path.manager";

const exec = require('child_process').exec;

export default class Task {
    public status: TaskStatusEnum = TaskStatusEnum.WAIT;
    private tag = "";
    private testTime: number = 2000;
    private command: string = "";

    private taskStartListener?: Function = null;
    private taskSuccessListener?: Function = null;
    private taskFailListener?: Function = null;

    private appExec?: any = null;

    constructor(command: string, index: string) {
        this.command = command;
        this.tag = index;
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
            this.setStatus(TaskStatusEnum.ERROR);
            if (this.appExec) {
                this.appExec.kill();
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

    private runExec(command: any) {
        this.setStatus(TaskStatusEnum.RUNNING);
        setTimeout(() => {
            if (this.taskStartListener) {
                this.taskStartListener(this.getTag());
            }
            this.appExec = exec(command, (error, stdout, stderr) => {
                console.log("xx: ", error);
                console.log("x2:", stdout);
                console.log("x3:", stderr);
                if (stdout.indexOf("COMPLETE") != -1) {
                    this.setStatus(TaskStatusEnum.SUCCESS);
                    if (this.taskSuccessListener) {
                        this.taskSuccessListener(this.getTag());
                    }
                } else {
                    this.setStatus(TaskStatusEnum.ERROR);
                    if (this.taskFailListener) {
                        this.taskFailListener(this.getTag());
                    }
                }
            });
        }, 100);

    }
}
