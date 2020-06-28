import {TaskStatusEnum} from "../queue/TaskStatusEnum";
import NewTask from "./NewTask";
import axios from "axios";
import MinShengEntity from "../../entity/MinShengEntity";
import Logger from "../Logger";
import {MinShengStatusEnum} from "../MinShengStatusEnum";

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
        this.status = TaskStatusEnum.RUNNING;
        this.eventCallback(MinShengStatusEnum.RUNNING, this.data);
        this.eventStart(this.data);
        setTimeout(() => {
            this.requestYouxinUrl();
        }, 4000);
    }

    public stopTask(): void {
        this.eventCallback(MinShengStatusEnum.ERROR, this.data);
        super.stopTask();
    }

    private requestYouxinUrl() {
        if (!this.isRunTask) {
            Logger.log(TAG, "任务已终止，请求终止");
            return;
        }

        axios({
            url: this.url, method: "POST",
            data: `account=${JSON.stringify([{fundAcc: this.data.assetId, idNo: this.data.id}])}`,
            headers: {"Content-Type": "application/x-www-form-urlencoded"}
        }).then((response) => {
            if (!this.isRunTask) {
                this.fail(MinShengStatusEnum.ERROR, TAG, "任务已终止，请求忽略");
                return;
            }
            if (response.data.data.length <= 0) {
                this.fail(MinShengStatusEnum.DATA_NULL, TAG, "请求数据为 NULL，无效数据");
                return;
            }

            this.eventCallback(MinShengStatusEnum.SUCCESS, this.data);
            this.data.url = response.data.data[0].url;

            Logger.log(TAG, "请求成功");
            this.eventSuccess(this.data);
            return;
        }).catch((error) => {
            this.eventCallback(MinShengStatusEnum.ERROR, this.data);

            if (!this.isRunTask) {
                this.fail(MinShengStatusEnum.ERROR, TAG, "任务已终止，错误请求忽略");
                return;
            }

            if (error.response) {
                // 仅仅捕获 404，如果有其他问题再进行捕获
                if (String(error.response.status) === "404") {
                    this.fail(MinShengStatusEnum.ERROR_404, TAG, "接口地址不存在");
                    return;
                } else {
                    this.fail(MinShengStatusEnum.ERROR, TAG, "未处理的错误");
                }
            } else {
                this.fail(MinShengStatusEnum.UNKNOWN, TAG, "未捕获的异常信息");
            }
        });
    }
}

