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
        this.eventCallback(MinShengStatusEnum.RUNNING, this.data);
        this.eventStart(this.data);

        this.setPdfOutputPath();

        setTimeout(() => {
            let pdf = new jsPDF('p', 'pt', 'a4', true);
            this.testAddFile(this.getWebOutputPath(), pdf);
        }, 100);
    }

    public stopTask(): void {
        this.eventCallback(MinShengStatusEnum.ERROR, this.data);
        super.stopTask();
    }

    /** 获得网页解析的输出路径 */
    private getWebOutputPath(): string {
        if (!this.data) {
            return;
        }
        return this.data.output + this.data.contractNo + "-银行流水/";
    }

    private setPdfOutputPath(): void {
        if (!this.data) {
            return;
        }
        this.data.pdfOutput = this.data.output + this.data.contractNo + "-银行流水-PDF/";
    }

    private async testAddFile(path: string, pdf: jsPDF): Promise<any> {
        let files = [];

        PDFManager.readFileList(path, files);
        this.batchAddPictures(pdf, files);

        let dataUri = pdf.output("arraybuffer");

        if (!this.isRunTask) {
            this.fail(MinShengStatusEnum.ERROR, TAG, "任务终止，不保存文件");
            return;
        }

        this.mkdirRecursive(this.data.pdfOutput, () => {
            this.writeFile(this.data.pdfOutput + this.data.id + '.pdf', dataUri);
        });
    }

    private async batchAddPictures(pdf: jsPDF, filesPath: Array<any>): Promise<any> {
        filesPath = filesPath || [];

        for (let i = 0; i < filesPath.length; i++) {
            if (!this.isRunTask) {
                this.fail(MinShengStatusEnum.ERROR, TAG, "任务终止，停止创建");
                return;
            }

            let filePath = filesPath[i] || {};
            let content = await this.readFile(filePath.path + filePath.filename);
            pdf.addPage([filePath.width, filePath.height]);
            pdf.addImage(content, "PNG", 0, 0, filePath.width, filePath.height, "", "MEDIUM");
            Logger.log(TAG, `index[${i}]`);
        }
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


    private readFile(pathName: string) {
        return new Promise((resolve, reject) => {
            fs.readFile(pathName,
                (error, data) => {
                    resolve(data);
                });
        });
    }
}
