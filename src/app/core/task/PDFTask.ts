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
    /** jpeg 文件信息 */
    private jpegFiles: Array<any> = new Array<any>();

    constructor(data: MinShengEntity) {
        super();
        this.data = data;
    }

    public startTask(): void {
        super.startTask();
        this.status = TaskStatusEnum.RUNNING;
        this.eventCallback(MinShengStatusEnum.RUNNING, this.data);
        this.eventStart(this.data);

        // 文件路径
        let path = this.data.output + this.data.contractNo + "-银行流水/";
        this.data.pdfOutput = this.data.output + "PDF/";

        this.generationPDF(path);
    }

    public stopTask(): void {
        this.eventCallback(MinShengStatusEnum.ERROR, this.data);
        super.stopTask();
    }

    /**
     * PDF 生成
     * @param path  原始文件路径
     */
    private async generationPDF(path: string): Promise<any> {
        await this.generateLoanPDF(path);
        await this.generateAdvancePDF(path);
    }

    /**
     * 获取 JPEG 文件
     * @param path 原始文件路径
     */
    private getJpegFiles(path: string): Array<any> {
        if (this.jpegFiles.length <= 0) {
            PDFManager.readJPEGFileList(path, this.jpegFiles);
            PDFManager.jpegSort(this.jpegFiles);
        }
        return this.jpegFiles;
    }

    private createPDFObj(): jsPDF {
        let pdf = new jsPDF('p', 'pt', 'a4', true);
        pdf.deletePage(1); // 删除第一页
        return pdf;
    }

    private async addImageToPDF(pdf: jsPDF, jpegs: Array<any>,
                                fail: (status: MinShengStatusEnum, tag: string, log: string) => void): Promise<any> {
        for (let i = 0; i < jpegs.length; i++) {
            if (!this.isRunTask) {
                fail(MinShengStatusEnum.ERROR, TAG, "任务终止，停止创建");
                return;
            }
            let content = await this.readFile(jpegs[i].path + jpegs[i].filename);
            pdf.addPage([jpegs[i].width, jpegs[i].height]);
            pdf.addImage(content, "JPEG", 0, 0, jpegs[i].width, jpegs[i].height, "", "MEDIUM");
            Logger.log(TAG, `添加 PDF 图片 [${i}]`);
        }

        let dataUri = pdf.output("arraybuffer");
        if (!this.isRunTask) {
            fail(MinShengStatusEnum.ERROR, TAG, "任务终止，不保存文件");
            return;
        }
        return dataUri;
    }

    /**
     * 生成放款相关的逻辑
     * @param path 原始文件路径
     */
    private async generateLoanPDF(path: string): Promise<any> {
        let pdf = this.createPDFObj();

        this.getJpegFiles(path);
        let list: Array<any> = [];
        for (let i = 0; i < this.jpegFiles.length; i++) {
            let jpegData = this.jpegFiles[i] || {};
            if (jpegData.filename.indexOf("账号") !== -1 ||
                jpegData.filename.indexOf("放款流水") !== -1
            ) {
                list.push(jpegData);
            }
        }
        let dataUri = await this.addImageToPDF(pdf, list, (status, tag, log) => {
            this.fail(status, tag, log);
            return;
        });

        let natPath = this.data.pdfOutput + "放款流水/";
        this.writeContentToPDF(natPath, this.data.contractNo + '-银行放款流水.pdf', dataUri);
    }

    /**
     * 生成垫付相关的逻辑
     * @param path 原始文件路径
     */
    private async generateAdvancePDF(path: string): Promise<any> {
        let pdf = this.createPDFObj();

        this.getJpegFiles(path);
        let list: Array<any> = [];
        for (let i = 0; i < this.jpegFiles.length; i++) {
            let jpegData = this.jpegFiles[i] || {};
            if (jpegData.filename.indexOf("垫付流水") !== -1) {
                list.push(jpegData);
            }
        }

        let dataUri = await this.addImageToPDF(pdf, list, (status, tag, log) => {
            this.fail(status, tag, log);
            return;
        });

        let natPath = this.data.pdfOutput + "垫付流水/";
        this.writeContentToPDF(natPath, this.data.contractNo + '-银行垫付流水.pdf', dataUri);
    }

    /**
     * 将内容写入pdf 输出目录
     * @param path      文件路径
     * @param filename  文件名称
     * @param conetnt   文件内容
     */
    private writeContentToPDF(path: string, filename: string, conetnt: string) {
        this.mkdirRecursive(path, () => {
            this.writeFile(path + filename, conetnt);
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

