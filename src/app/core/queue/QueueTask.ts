import NewTask from "../task/NewTask";
import {TaskStatusEnum} from "./TaskStatusEnum";
import UUIDUtils from "../UUIDUtils";
import {TaskFailListener, TaskStartListener, TaskSuccessListener} from "./TaskSuccessListener";
import Logger from "../Logger";
import TaskCallbackListener from "./TaskCallbackListener";

const TAG = "QueueTask";

export default class QueueTask<DATA, TASK extends NewTask<DATA>> {
    private cacheQueue: Map<string, TASK> = new Map<string, TASK>();
    private queue: Map<string, TASK> = new Map<string, TASK>();
    private completeQueue: Map<string, TASK> = new Map<string, TASK>();
    private waitQueue: Map<string, TASK> = new Map<string, TASK>();
    private progressQueue: Map<string, Promise<TASK>> = new Map<string, Promise<TASK>>();

    private startListener: TaskStartListener<DATA>;
    private successListener: TaskSuccessListener<DATA>;
    private failListener: TaskFailListener<DATA>;

    private taskCallback: TaskCallbackListener<DATA>;

    private tag? = null;
    private maxThreadNumber: number = 1;
    private isRunTask: boolean = false;

    constructor(tag?: string) {
        this.tag = tag;
    }

    public setStartListener(listener: TaskStartListener<DATA>): void {
        this.startListener = listener;
    }

    public setSuccessListener(listener: TaskSuccessListener<DATA>): void {
        this.successListener = listener;
    }

    public setFailListener(listener: TaskFailListener<DATA>): void {
        this.failListener = listener;
    }

    public setCallback(callback: TaskCallbackListener<DATA>): void {
        this.taskCallback = callback;
    }

    public startServe(): void {
        if (this.isRunTask) {
            this.log("队列已经开启");
            return;
        }
        if (this.maxThreadNumber <= 0) {
            this.log("线程数不能为小于0");
            return;
        }
        this.log("开启队列");
        this.isRunTask = true;
        this.runNextTask();
    }

    public stopServe(): void {
        this.stopTask();

        this.cacheQueue.clear();
        this.queue.clear();
        this.completeQueue.clear();
        this.waitQueue.clear();
        this.progressQueue.clear();
    }

    public addTask(task: TASK): void {
        let uuid = UUIDUtils.buildUUID(32, 32);
        this.log("新任务: ", uuid);
        this.queue.set(uuid, task);
        this.cacheQueue.set(uuid, task);

        if (this.isRunTask) {
            this.runNextTask();
        }
    }

    public stopTask(): void {
        this.isRunTask = false;
        // 将缓存队列中的任务，全部放到等待队列中
        // @ts-ignore
        for (let [key, value] of this.progressQueue) {
            let task = this.cacheQueue.get(key);
            task.stopTask();
            this.waitQueue.set(key, task);
            this.removeProgressTaskByIndex(key);
        }
        this.logger();
    }

    /** 执行下一个任务 */
    private runNextTask(): void {
        let idleThreadCount = this.getIdleThreadCount();
        let waitTaskCount = this.getWaitTaskCount();
        let taskCount = this.getQueueCount();

        if (!this.isRunTask) {
            this.log("任务终止...");
            return;
        }

        if (idleThreadCount === 0) {
            this.log("暂无空闲线程，等待中...");
            return;
        }

        this.log(
            "继续执行任务，闲置线程：", idleThreadCount,
            "等待的任务数：", waitTaskCount,
            "剩余的任务数：", taskCount,
        );

        if ((waitTaskCount + taskCount) == 0 && this.getProgressThreadCount() === 0) {
            this.log("暂无新任务，等待中...");
            return;
        }

        function forTask(_this: any, count: number, queue: Map<string, TASK>) {
            let i = 0;
            // @ts-ignore
            for (let [key, value] of queue) {
                // 当前任务已经超过重试
                if (value.currentRetry > value.retry) {
                    _this.removeTaskForQueueeOrWait(key);
                    _this.removeProgressTaskByIndex(key);
                    _this.runNextTask();
                    return;
                }

                if (i < count) {
                    value.currentRetry++;
                    _this.progressQueue.set(key, _this.createProgressTask(key, value));
                    _this.logger();
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
            forTask(this, idleThreadCount - waitTaskCount, this.queue);
        }
    }

    /**
     * 创建一个任务
     * 任务有可能来自 queue 或 waitQueue
     * @param key
     * @param task
     */
    private createProgressTask(key: string, task: TASK): Promise<TASK> {
        return new Promise((resolve, reject) => {
            this.log("开始执行任务: ", key);
            this.removeTaskForQueueeOrWait(key);

            task.setTaskCallback((status: any, data: DATA) => {
                if (this.taskCallback) {
                    this.taskCallback(status, data);
                }
            })
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
                this.removeTaskForQueueeOrWait(key);
                this.removeProgressTaskByIndex(key);

                this.log("任务执行成功...", key);
                this.logger();
                this.runNextTask();
            })
            task.setFailListener((data: DATA) => {
                if (this.failListener) {
                    this.failListener(data);
                }

                this.waitQueue.set(key, task);
                this.removeProgressTaskByIndex(key);

                this.log("任务执行失败...", key);
                this.logger();
                this.runNextTask();
            })

            task.startTask();
            resolve();
        })
    }

    private removeTaskForQueueeOrWait(key: string): boolean {
        if (this.waitQueue.has(key)) {
            return this.waitQueue.delete(key);
        } else if (this.queue.has(key)) {
            return this.queue.delete(key);
        }
        return false;
    }

    private removeTaskForQueue(key: string): boolean {
        if (this.queue.has(key)) {
            return this.queue.delete(key);
        }
        return false;
    }

    private getTaskForQueueOrWait(key: string): TASK {
        if (this.waitQueue.has(key)) {
            return this.waitQueue.get(key);
        } else if (this.queue.has(key)) {
            return this.queue.get(key);
        }
        return null;
    }

    private removeProgressTaskByIndex(key: string): boolean {
        if (this.progressQueue.has(key)) {
            return this.progressQueue.delete(key);
        } else {
            return false;
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

    public getCacheQueue(): Map<string, TASK> {
        return this.cacheQueue;
    }

    public getCacheQueueCount(): number {
        return this.cacheQueue.size || 0;
    }

    public getComplateCount(): number {
        return this.completeQueue.size || 0;
    }

    private getQueueCount(): number {
        let count = 0;
        // @ts-ignore
        for (let [key, value] of this.queue) {
            if (this.queue.get(key).status !== TaskStatusEnum.SUCCESS &&
                this.queue.get(key).status !== TaskStatusEnum.RUNNING) {
                count++;
            }
        }
        return count;
    }

    public setThreadCount(count: number): void {
        this.maxThreadNumber = count;
    }

    private logger() {
        this.log(
            "缓存的任务数：" + this.getCacheQueueCount() + " " +
            "执行的任务数：" + this.getProgressThreadCount() + " " +
            "等待的任务数：" + this.getWaitTaskCount() + " " +
            "剩余的任务数：" + (this.getQueueCount() + this.getWaitTaskCount()) + " " +
            "完成的任务数：" + this.getComplateCount() + " " +
            "空闲的线程数：" + this.getIdleThreadCount() + " "
        );
    }

    private log(...optionalParams: any): void {
        let tag = TAG;
        if (this.tag) {
            tag = TAG + " | " + this.tag;
        }
        Logger.log(tag, ...optionalParams);
    }
}
