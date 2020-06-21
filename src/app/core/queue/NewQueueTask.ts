import NewTask from "./NewTask";
import {NewTaskStatusEnum} from "./NewTaskStatusEnum";
import UUIDUtils from "./UUIDUtils";
import {TaskFailListener, TaskStartListener, TaskSuccessListener} from "./TaskSuccessListener";
import Logger from "./Logger";

const TAG = "NewQueueTask";

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

    private startListener: TaskStartListener<DATA>;
    private successListener: TaskSuccessListener<DATA>;
    private failListener: TaskFailListener<DATA>;

    public setStartListener(listener: TaskStartListener<DATA>): void {
        this.startListener = listener;
    }

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

        if (idleThreadCount === 0) {
            console.warn("暂无空闲线程，等待中...");
            return;
        }

        Logger.log(TAG,
            "继续执行任务，闲置线程：", idleThreadCount,
            "等待的任务数：", waitTaskCount,
            "剩余的任务数：", cacheTaskCount,
        );

        if ((waitTaskCount + cacheTaskCount) == 0 && this.getProgressThreadCount() === 0) {
            Logger.log(TAG, "暂无新任务，暂停");
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
            Logger.log(TAG, "开启一个任务: ", key);
            this.removeTaskForCacheOrWait(key);

            task.setStartListener((data: DATA) => {
                if (this.startListener) {
                    this.startListener(data);
                }
            });
            task.setSuccessListener((data: DATA) => {
                if (this.successListener) {
                    this.successListener(data);
                }

                this.completeQueue.set(key, task);
                this.removeTaskForCacheOrWait(key);
                this.removeProgressTaskByIndex(key);

                Logger.log(TAG, "任务执行成功...", key);
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

                Logger.log(TAG, "任务执行失败...", key);
                this.logger();
                this.runNextTask();
            })

            task.startTask();
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
        Logger.log("MinShengController", "添加新任务");
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

    public getChacheQueue(): Map<string, TASK> {
        return this.cacheQueue;
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
        Logger.log(TAG, `
执行的任务数：${this.getProgressThreadCount()},
等待的任务数：${this.getWaitTaskCount()},
剩余任务：${this.getCacheCount() + this.getWaitTaskCount()},
完成的任务：${this.completeQueue.size},
空闲的线程数：${this.getIdleThreadCount()},
`);
    }
}
