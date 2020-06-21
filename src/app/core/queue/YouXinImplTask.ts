import {NewTaskStatusEnum} from "./NewTaskStatusEnum";
import NewTask from "./NewTask";
import axios from "axios";
import MinShengEntity from "../../entity/MinShengEntity";
import Logger from "./Logger";
import {MinShengStatusEnum} from "./MinShengStatusEnum";

const TAG: string = "YouXinImplTask";

export default class YouXinImplTask extends NewTask<MinShengEntity> {
    private url: string = "https://data-sharing.renrendai.com/cmbc/accountUrlList";
    constructor(data: MinShengEntity) {
        super();
        this.data = data;
    }

    public startTask(): void {
        super.startTask();
        Logger.log(TAG, "开启任务");
        this.status = NewTaskStatusEnum.RUNNING;
        this.data.youxinStatus = MinShengStatusEnum.RUNNING;
        this.requestYouxinUrl();
    }

    public stopTask(): void {
        super.stopTask();
    }

    private requestYouxinUrl() {
        axios({
            url: this.url, method: "POST",
            data: `account=${JSON.stringify([{fundAcc: this.data.assetId, idNo: this.data.id}])}`,
            headers: {"Content-Type": "application/x-www-form-urlencoded"}
        }).then((response) => {
            if (!this.isRunTask) {
                Logger.log(TAG, "任务已终止，请求忽略");
                this.eventFail(this.data);
                return;
            }
            if (response.data.data.length <= 0) {
                Logger.log(TAG, "请求数据为 NULL，无效数据");
                this.eventFail(this.data);
                return;
            }

            this.data.youxinStatus = MinShengStatusEnum.SUCCESS;
            this.data.url = response.data.data[0].url;

            Logger.log(TAG, "请求成功");
            this.eventSuccess(this.data);
            return;
        }).catch((error) => {
            this.data.youxinStatus = MinShengStatusEnum.ERROR;

            if (!this.isRunTask) {
                Logger.log(TAG, "任务已终止，错误请求忽略");
                this.eventFail(this.data);
                return;
            }

            let status = "";
            if (error.response) {
                // 仅仅捕获 404，如果有其他问题再进行捕获
                if (String(error.response.status) === "404") {
                    status = String(error.response.status);
                    this.eventFail(this.data);
                    // fail(status);
                    return;
                } else {
                    // TODO 确定要重试吗？
                    // this.requestAxios(success, fail, data);
                }
            } else {
                status = "UNKNOWN";
                this.eventFail(this.data);
                Logger.log(TAG, "未捕获的异常信息");
                // fail(status);
                // console.log('未捕获的异常信息', error.message);
            }
        });
    }
}

