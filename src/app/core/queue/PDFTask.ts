import {NewTaskStatusEnum} from "./NewTaskStatusEnum";
import NewTask from "./NewTask";
import MinShengEntity from "../../entity/MinShengEntity";
import Logger from "./Logger";
import {MinShengStatusEnum} from "./MinShengStatusEnum";
import PDFManager from "../../home/PDFManager";
import jsPDF from 'jspdf';

const fs = require("fs");

const TAG: string = "PDFTask";

export default class PDFTask extends NewTask<MinShengEntity> {
    constructor(data: MinShengEntity) {
        super();
        this.data = data;
    }

    public startTask(): void {
        super.startTask();
        Logger.log(TAG, "开启任务");
        this.status = NewTaskStatusEnum.RUNNING;
        this.eventCallback(MinShengStatusEnum.RUNNING, this.data);
        this.eventStart(this.data);

        let path = this.data.output + this.data.contractNo + "-银行流水/";
        this.data.pdfOutput = this.data.output + this.data.contractNo + "-银行流水-PDF/";

        new Promise((resolve, reject) => {
            Logger.log(TAG, "新线程");
            let pdf = new jsPDF('p', 'pt', 'a4', true);
            this.testAddFile(path, pdf);
        });
    }

    public stopTask(): void {
        this.eventCallback(MinShengStatusEnum.ERROR, this.data);
        super.stopTask();
    }

    private async testAddFile(path: string, pdf: jsPDF): Promise<any> {
        let pdfManager = new PDFManager();
        let files = [];
        pdfManager.readFileList(path, files);
        for (let i = 0; i < files.length; i++) {
            if (!this.isRunTask) {
                Logger.log(TAG, "任务终止，停止创建");
                this.eventCallback(MinShengStatusEnum.ERROR, this.data);
                this.eventFail(this.data);
                return;
            }
            let content = await this.readFile(files[i].path + files[i].filename);
            pdf.addPage([files[i].width, files[i].height]);
            pdf.addImage(content, "PNG", 0, 0, files[i].width, files[i].height, "", "MEDIUM");
            Logger.log(TAG, `index[${i}]: `);
        }

        let dataUri = pdf.output("arraybuffer");
        if (!this.isRunTask) {
            Logger.log(TAG, "任务终止，不保存文件");
            this.eventCallback(MinShengStatusEnum.ERROR, this.data);
            this.eventFail(this.data);
            return;
        }
        fs.mkdir(this.data.pdfOutput, {recursive: true}, (err) => {
            if (err) {
                Logger.log(TAG, "目录创建失败");
                this.eventCallback(MinShengStatusEnum.MAKE_DIR_FAIL, this.data);
                this.eventFail(this.data);
                return;
            }
            // @ts-ignore
            fs.writeFile(this.data.pdfOutput + this.data.id + '.pdf', new Buffer.from(dataUri),
                (error) => {
                    if (error) {
                        Logger.log(TAG, "文件写入失败");
                        this.eventCallback(MinShengStatusEnum.WRITE_FAIL, this.data);
                        this.eventFail(this.data);
                        return;
                    }
                    this.eventCallback(MinShengStatusEnum.SUCCESS, this.data);
                    this.eventSuccess(this.data);
                });
        });
    }

    private readFile(pathName: string) {
        return new Promise((resolve, reject) => {
            fs.readFile(pathName,
                (error, data) => {
                    resolve(data);
                });
        });
    }
}

