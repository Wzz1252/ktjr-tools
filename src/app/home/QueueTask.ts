import Task from "./Task";
import {TaskStatusEnum} from "./TaskStatusEnum";

export default class QueueTask {
    public maxTaskNum: number = 2;
    public currentTaskNum: number = 0;
    public currentIndex: number = 0;
    public isStop: boolean = false;

    public cacheTaskQueue: Task[] = [];
    public runningTaskQueue: Task[] = [];

    public completeListener?: Function = null;
    public successListener?: Function = null;
    public failListener?: Function = null;
    public startListener?: Function = null;
    public jumpListener?: Function = null;

    public setTaskNumber(maxTaskNum: number): void {
        this.maxTaskNum = maxTaskNum;
    }

    public setCompleteListener(l: Function): void {
        this.completeListener = l;
    }

    public setSuccessListener(l: Function): void {
        this.successListener = l;
    }

    public setFailListener(l: Function): void {
        this.failListener = l;
    }

    public setStartListener(l: Function): void {
        this.startListener = l;
    }

    public setJumpListener(l: Function): void {
        this.jumpListener = l;
    }

    public addTask(exec: Task): void {
        this.cacheTaskQueue.push(exec);
        this.addTaskListener(exec);
    }

    private addTaskListener(exec: Task): void {
        exec.setTaskStartListener((index: number) => {
            if (this.startListener) this.startListener(index);
        });
        exec.setTaskJumpListener((index: number) => {
            if (this.jumpListener) this.jumpListener(index);
            if (this.isStop) {
                return;
            }
            this.nextTask();
        });
        exec.setTaskSuccessListener((index: number) => {
            if (this.successListener) this.successListener(index);
            if (this.isStop) {
                return;
            }
            this.nextTask();
        });
        exec.setTaskFailListener((index: number, errorCode: string) => {
            if (this.failListener) this.failListener(index, errorCode);
            if (this.isStop) {
                return;
            }
            this.nextTask();
        });
    }

    public run(): void {
        console.log("开始执行");
        this.stopAll();
        this.isStop = false;
        let currentRun = 0;
        // let max = Math.min(this.cacheTaskQueue.length, this.maxTaskNum);
        for (let i = 0; i < this.cacheTaskQueue.length; i++) {
            if (currentRun >= this.maxTaskNum) {
                break;
            }
            if (this.cacheTaskQueue[i].getStatus() !== TaskStatusEnum.SUCCESS) {
                this.cacheTaskQueue[i].run();
                ++currentRun;
                ++this.currentTaskNum;
                ++this.currentIndex;
            }
        }
    }

    public stopAll(): void {
        this.isStop = true;
        this.currentTaskNum = 0;
        this.currentIndex = 0;
        for (let i = 0; i < this.cacheTaskQueue.length; i++) {
            this.cacheTaskQueue[i].kill();
        }
    }

    public nextTask() {
        let task = undefined;
        for (let i = this.currentIndex; i < this.cacheTaskQueue.length; i++) {
            if (this.cacheTaskQueue[i].getStatus() !== TaskStatusEnum.SUCCESS) {
                task = this.cacheTaskQueue[i];
                this.currentIndex = i;
                break;
            }
        }
        // let task = this.cacheTaskQueue[this.currentIndex];
        // console.log("数据", task);
        if (!task) {
            --this.currentTaskNum;
            if (this.currentTaskNum <= 0) {
                // console.log("结束了？", this.currentTaskNum);
                if (this.completeListener) this.completeListener();
            }
            return;
        }
        // console.log("执行新的任务", this.currentTaskNum);
        task.run();
        ++this.currentIndex;
    }
}
