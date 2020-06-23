import {TaskStatusEnum} from "../queue/TaskStatusEnum";
import NewTask from "./NewTask";
import MinShengEntity from "../../entity/MinShengEntity";
import Logger from "../Logger";
import {MinShengStatusEnum} from "../MinShengStatusEnum";
import PDFManager from "../PDFManager";
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
        this.status = TaskStatusEnum.RUNNING;
        this.eventCallback(MinShengStatusEnum.RUNNING, this.data);
        this.eventStart(this.data);

        let path = this.data.output + this.data.contractNo + "-银行流水/";
        this.data.pdfOutput = this.data.output + "PDF/";

        new Promise((resolve, reject) => {
            let pdf = new jsPDF('p', 'pt', 'a4', true);
            pdf.deletePage(1); // 删除第一页
            this.pdfGeneration(path, pdf);
        });
    }

    public stopTask(): void {
        this.eventCallback(MinShengStatusEnum.ERROR, this.data);
        super.stopTask();
    }

    private async pdfGeneration(path: string, pdf: jsPDF): Promise<any> {
        let files = [];
        PDFManager.readJPEGFileList(path, files);
        PDFManager.jpegSort(files);
        for (let i = 0; i < files.length; i++) {
            if (!this.isRunTask) {
                Logger.log(TAG, "任务终止，停止创建");
                this.eventCallback(MinShengStatusEnum.ERROR, this.data);
                this.eventFail(this.data);
                return;
            }
            let content = await this.readFile(files[i].path + files[i].filename);
            pdf.addPage([files[i].width, files[i].height]);
            pdf.addImage(content, "JPEG", 0, 0, files[i].width, files[i].height, "", "MEDIUM");
            Logger.log(TAG, `index[${i}]`);
        }
        let dataUri = pdf.output("arraybuffer");
        if (!this.isRunTask) {
            Logger.log(TAG, "任务终止，不保存文件");
            this.eventCallback(MinShengStatusEnum.ERROR, this.data);
            this.eventFail(this.data);
            return;
        }

        this.mkdirRecursive(this.data.pdfOutput, () => {
            this.writeFile(this.data.pdfOutput + this.data.contractNo + '-银行流水.pdf', dataUri);
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

    /**
     * 创建多级目录
     * @param path 创建的目录
     * @param success
     */
    private mkdirRecursive(path: string, success: Function): void {
        fs.mkdir(path, {recursive: true}, (err) => {
            if (err) {
                this.fail(MinShengStatusEnum.MAKE_DIR_FAIL, TAG, "目录创建失败");
                return;
            }
            if (success) {
                success();
            }
        });
    }

    /**
     * 将内容写入文件
     * @param output 文件地址
     * @param dataUri 文件内容
     */
    private writeFile(output: string, dataUri: any): void {
        // @ts-ignore
        fs.writeFile(output, new Buffer.from(dataUri),
            (error) => {
                if (error) {
                    this.fail(MinShengStatusEnum.WRITE_FAIL, TAG, "文件写入失败");
                    return;
                }
                this.eventCallback(MinShengStatusEnum.SUCCESS, this.data);
                this.eventSuccess(this.data);
            });
    }
}

