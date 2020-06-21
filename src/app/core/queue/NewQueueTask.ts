import MinShengTask from "../../home/MinShengTask";
import {TaskStatusEnum} from "../../home/TaskStatusEnum";
import NewTask from "./NewTask";
import {NewTaskStatusEnum} from "./NewTaskStatusEnum";
import UUIDUtils from "./UUIDUtils";
import Net = Electron.Net;
import {TaskFailListener, TaskSuccessListener} from "./TaskSuccessListener";

/**
 * 1. 开启任务
 * 2. 暂停任务
 * 3. 终止任务
 * 4. 重置任务
 * 5. 添加任务（如果任务为null，就进行等待，等添加了新的任务，直接开始执行）
 */
export default class NewQueueTask<DATA, TASK extends NewTask<DATA>> {
    // 缓存队列（存放未完成的任务）
    private cacheQueue: Map<string, TASK> = new Map<string, TASK>();
    // 完成队列（存放已完成的任务）
    private completeQueue: Map<string, TASK> = new Map<string, TASK>();
    // 等待队列（存放需要重试的任务
    private waitQueue: Map<string, TASK> = new Map<string, TASK>();
    // 执行中的任务
    private progressQueue: Map<string, Promise<TASK>> = new Map<string, Promise<TASK>>();

    private maxThreadNumber: number = 2;
    private isRunTask: boolean = false;

    private successListener: TaskSuccessListener<DATA>;
    private failListener: TaskFailListener<DATA>;

    public setSuccessListener(listener: TaskSuccessListener<DATA>): void {
        this.successListener = listener;
    }

    public setFailListener(listener: TaskFailListener<DATA>): void {
        this.failListener = listener;
    }

    public startTask(): void {
        if (this.isRunTask) {
            console.log("任务正在执行中...");
            return;
        }
        if (this.cacheQueue.size <= 0) {
            console.log("请先通过 addTask 添加任务");
            return;
        }
        if (this.maxThreadNumber <= 0) {
            console.log("最大线程数不能为 0");
            return;
        }

        this.isRunTask = true;
        // 执行线程
        let num = Math.min(this.maxThreadNumber, this.cacheQueue.size);
        let i = 0;
        // @ts-ignore
        for (let [key, value] of this.cacheQueue) {
            if (i < num) {
                this.progressQueue.set(key, this.createProgressTask(key, value));
                i++;
            } else break;
        }
        this.logger();
    }

    private runNextTask(): void {
        let idleThreadCount = this.getIdleThreadCount();
        let waitTaskCount = this.getWaitTaskCount();
        let cacheTaskCount = this.getCacheCount();

        if (!this.isRunTask) {
            console.warn("任务终止...");
            return;
        }

        console.warn("TAG",
            "继续执行任务，闲置线程：", idleThreadCount,
            "等待的任务数：", waitTaskCount,
            "剩余的任务数：", cacheTaskCount,
        );

        if ((waitTaskCount + cacheTaskCount) == 0) {
            console.warn("执行完成，任务结束");
            return;
        }

        function forTask(_this: any, count: number, queue: Map<string, TASK>) {
            let i = 0;
            // @ts-ignore
            for (let [key, value] of queue) {
                if (i < count) {
                    _this.progressQueue.set(key, _this.createProgressTask(key, value));
                    i++;
                }
            }
        }

        if (idleThreadCount <= waitTaskCount) {
            forTask(this, idleThreadCount, this.waitQueue);
        } else {
            // 执行等待中的所有任务
            forTask(this, waitTaskCount, this.waitQueue);
            // 获取剩余的空闲线程，执行缓存中的任务
            forTask(this, idleThreadCount - waitTaskCount, this.cacheQueue);
        }
    }

    /**
     * 创建一个任务
     * 任务有可能来自 cacheQueue 或 waitQueue
     * @param key
     * @param task
     */
    private createProgressTask(key: string, task: TASK): Promise<TASK> {
        return new Promise((resolve, reject) => {
            console.log("开启一个任务...", key);
            task.startTask();
            task.setSuccessListener((data: DATA) => {
                if (this.successListener) {
                    this.successListener(data);
                }

                this.completeQueue.set(key, task);
                this.removeTaskForCacheOrWait(key);
                this.removeProgressTaskByIndex(key);

                console.log("任务执行成功...", key);
                this.logger();
                this.runNextTask();
            })
            task.setFailListener((data: DATA) => {
                if (this.failListener) {
                    this.failListener(data);
                }

                this.waitQueue.set(key, task);
                this.removeTaskForCacheOrWait(key);
                this.removeProgressTaskByIndex(key);

                console.log("任务执行失败...", key);
                this.logger();
                this.runNextTask();
            })
            resolve();
        })
    }

    private removeTaskForCacheOrWait(key: string): boolean {
        if (this.waitQueue.has(key)) {
            return this.waitQueue.delete(key);
        } else if (this.cacheQueue.has(key)) {
            return this.cacheQueue.delete(key);
        }
        return false;
    }

    private removeTaskForCache(key: string): boolean {
        if (this.cacheQueue.has(key)) {
            return this.cacheQueue.delete(key);
        }
        return false;
    }

    private getTaskForCacheOrWait(key: string): TASK {
        if (this.waitQueue.has(key)) {
            return this.waitQueue.get(key);
        } else if (this.cacheQueue.has(key)) {
            return this.cacheQueue.get(key);
        }
        return null;
    }

    private removeProgressTaskByIndex(index: string): boolean {
        return this.progressQueue.delete(index);
    }

    public stopTask(): void {
        this.isRunTask = false;

        // 将缓存队列中的任务，全部放到等待队列中
        // @ts-ignore
        for (let [key, value] of this.progressQueue) {
            let task = this.getTaskForCacheOrWait(key);
            task.stopTask();
            this.waitQueue.set(key, task);
            this.removeTaskForCache(key);
        }
        this.logger();
    }

    public closeTask(): void {

    }

    public resetTask(): void {

    }

    public addTask2(task: TASK): void {
        console.warn("添加了一个新任务");
        this.cacheQueue.set(UUIDUtils.buildUUID(32, 32), task);

        if (this.isRunTask) {
            this.runNextTask();
        }
    }

    /** 当前执行的线程数 */
    public getProgressThreadCount(): number {
        return this.progressQueue.size || 0;
    }

    /** 空闲的线程数 */
    public getIdleThreadCount(): number {
        return this.maxThreadNumber - this.getProgressThreadCount();
    }

    /** 当前等待的任务数量 */
    public getWaitTaskCount(): number {
        return this.waitQueue.size || 0;
    }

    private getCacheCount(): number {
        let count = 0;
        // @ts-ignore
        for (let [key, value] of this.cacheQueue) {
            if (this.cacheQueue.get(key).status !== NewTaskStatusEnum.SUCCESS &&
                this.cacheQueue.get(key).status !== NewTaskStatusEnum.RUNNING) {
                count++;
            }
        }
        return count;
    }

    private logger() {
        console.log(`
执行的任务数：${this.getProgressThreadCount()},
等待的任务数：${this.getWaitTaskCount()},
剩余任务：${this.getCacheCount() + this.getWaitTaskCount()},
完成的任务：${this.completeQueue.size},
空闲的线程数：${this.getIdleThreadCount()},
`);
    }

    // ----------------------------------------------------------------------

    // public cacheTaskQueue: Array<MinShengTask> = new Array<MinShengTask>();
    //
    // /** 最大的任务数量 */
    // public maxTaskNum: number = 2;
    // public currentTaskNum: number = 0;
    // public currentIndex: number = 0;
    // public isStop: boolean = false;
    //
    // public completeListener?: Function = null;
    // public successListener?: TaskSuccessListener = null;
    // public failListener?: Function = null;
    // public startListener?: Function = null;
    // public jumpListener?: Function = null;
    //
    // public setTaskNumber(maxTaskNum: number): void {
    //     this.maxTaskNum = maxTaskNum;
    // }
    //
    // public setCompleteListener(l: Function): void {
    //     this.completeListener = l;
    // }
    //
    // public setSuccessListener(l: TaskSuccessListener): void {
    //     this.successListener = l;
    // }
    //
    // public setFailListener(l: Function): void {
    //     this.failListener = l;
    // }
    //
    // public setStartListener(l: Function): void {
    //     this.startListener = l;
    // }
    //
    // public setJumpListener(l: Function): void {
    //     this.jumpListener = l;
    // }
    //
    // public addTask(exec: MinShengTask): void {
    //     this.cacheTaskQueue.push(exec);
    //     this.addTaskListener(exec);
    // }
    //
    // private addTaskListener(exec: MinShengTask): void {
    //     exec.setTaskStartListener((index: number) => {
    //         if (this.startListener) this.startListener(index);
    //     });
    //     exec.setTaskJumpListener((index: number) => {
    //         if (this.jumpListener) this.jumpListener(index);
    //         if (this.isStop) {
    //             return;
    //         }
    //         this.nextTask();
    //     });
    //     exec.setTaskSuccessListener((index) => {
    //         if (this.successListener) this.successListener(index);
    //         if (this.isStop) {
    //             return;
    //         }
    //         this.nextTask();
    //     });
    //     exec.setTaskFailListener((index: number, errorCode: string) => {
    //         if (this.failListener) this.failListener(index, errorCode);
    //         if (this.isStop) {
    //             return;
    //         }
    //         this.nextTask();
    //     });
    // }
    //
    // public run(): void {
    //     console.log("开始执行");
    //     this.stopAll();
    //     this.isStop = false;
    //     let currentRun = 0;
    //     for (let i = 0; i < this.cacheTaskQueue.length; i++) {
    //         if (currentRun >= this.maxTaskNum) {
    //             break;
    //         }
    //         if (this.cacheTaskQueue[i].getStatus() !== TaskStatusEnum.SUCCESS) {
    //             this.cacheTaskQueue[i].run();
    //             ++currentRun;
    //             ++this.currentTaskNum;
    //             ++this.currentIndex;
    //         }
    //     }
    // }
    //
    // public stopAll(): void {
    //     this.isStop = true;
    //     this.currentTaskNum = 0;
    //     this.currentIndex = 0;
    //     for (let i = 0; i < this.cacheTaskQueue.length; i++) {
    //         this.cacheTaskQueue[i].kill();
    //     }
    // }
    //
    // public nextTask() {
    //     let task = undefined;
    //     for (let i = this.currentIndex; i < this.cacheTaskQueue.length; i++) {
    //         if (this.cacheTaskQueue[i].getStatus() !== TaskStatusEnum.SUCCESS) {
    //             task = this.cacheTaskQueue[i];
    //             this.currentIndex = i;
    //             break;
    //         }
    //     }
    //     if (!task) {
    //         --this.currentTaskNum;
    //         if (this.currentTaskNum <= 0) {
    //             if (this.completeListener) this.completeListener();
    //         }
    //         return;
    //     }
    //     task.run();
    //     ++this.currentIndex;
    // }
}
