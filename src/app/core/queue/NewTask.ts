import {NewTaskStatusEnum} from "./NewTaskStatusEnum";
import {TaskFailListener, TaskStartListener, TaskSuccessListener} from "./TaskSuccessListener";
import TaskCallbackListener from "./TaskCallbackListener";

const TAG = "NewTask";

export default class NewTask<ENTITY> {
    public data: ENTITY;

    /** 重试次数 */
    public retry: number = 3;
    public currentRetry: number = 0;
    public isRunTask: boolean = false;
    /** 任务状态 */
    public status: NewTaskStatusEnum = NewTaskStatusEnum.WAIT;

    public startListener: TaskStartListener<ENTITY>;
    public successListener: TaskSuccessListener<ENTITY>;
    public failListener: TaskFailListener<ENTITY>;
    public callback: TaskCallbackListener<ENTITY>;

    public startTask(): void {
        this.isRunTask = true;
        this.status = NewTaskStatusEnum.RUNNING;
    }

    public stopTask(): void {
        this.isRunTask = false;
        // this.eventFail(this.data);
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

    protected eventCallback(state: any, data: ENTITY): void {
        if (this.callback) {
            this.callback(state, data);
        }
    }

    protected eventStart(data: ENTITY) {
        this.status = NewTaskStatusEnum.RUNNING;
        if (this.startListener) {
            this.startListener(data);
        }
    }

    protected eventSuccess(data: ENTITY) {
        this.status = NewTaskStatusEnum.SUCCESS;
        if (this.successListener) {
            this.successListener(data);
        }
    }

    protected eventFail(data: ENTITY) {
        this.status = NewTaskStatusEnum.ERROR;
        if (this.failListener) {
            this.failListener(data);
        }
    }
}
