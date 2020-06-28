import {TaskStatusEnum} from "../queue/TaskStatusEnum";
import {TaskFailListener, TaskStartListener, TaskSuccessListener} from "../queue/TaskSuccessListener";
import TaskCallbackListener from "../queue/TaskCallbackListener";
import {MinShengStatusEnum} from "../MinShengStatusEnum";
import Logger from "../Logger";

const TAG = "NewTask";

export default class NewTask<ENTITY> {
    public data: ENTITY;

    /** 重试次数 */
    public retry: number = 3;
    /** 当前重试次数 */
    public currentRetry: number = 0;
    /** 是否正在运行 */
    public isRunTask: boolean = false;

    /** 任务状态 */
    public status: TaskStatusEnum = TaskStatusEnum.WAIT;

    public startListener: TaskStartListener<ENTITY>;
    public successListener: TaskSuccessListener<ENTITY>;
    public failListener: TaskFailListener<ENTITY>;
    public callback: TaskCallbackListener<ENTITY>;

    public startTask(): void {
        this.isRunTask = true;
        this.status = TaskStatusEnum.RUNNING;
    }

    public stopTask(): void {
        this.isRunTask = false;
    }

    public setMaxRetryCount(retry: number): void {
        this.retry = retry;
    }

    public setStartListener(l: TaskStartListener<ENTITY>) {
        this.startListener = l;
    }

    public setSuccessListener(l: TaskSuccessListener<ENTITY>) {
        this.successListener = l;
    }

    public setFailListener(l: TaskFailListener<ENTITY>) {
        this.failListener = l;
    }

    public setTaskCallback(callback: TaskCallbackListener<ENTITY>): void {
        this.callback = callback;
    }

    protected fail(status: MinShengStatusEnum, tag: string, log: string): void {
        if (tag) {
            Logger.log(tag, log);
        }
        this.eventCallback(status, this.data);
        this.eventFail(this.data);
    }

    protected eventCallback(state: any, data: ENTITY): void {
        if (this.callback) {
            this.callback(state, data);
        }
    }

    protected eventStart(data: ENTITY) {
        this.status = TaskStatusEnum.RUNNING;
        if (this.startListener) {
            this.startListener(data);
        }
    }

    protected eventSuccess(data: ENTITY) {
        this.status = TaskStatusEnum.SUCCESS;
        if (this.successListener) {
            this.successListener(data);
        }
    }

    protected eventFail(data: ENTITY) {
        this.status = TaskStatusEnum.ERROR;
        if (this.failListener) {
            this.failListener(data);
        }
    }
}
