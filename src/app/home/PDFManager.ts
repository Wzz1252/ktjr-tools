import jsPDF from 'jspdf';
import {Base64} from 'js-base64';

const imageSize = require('image-size');
const fs = require("fs");

export default class PDFManager {
    /**
     * 获取指定目录下的所有文件
     * @param path      文件夹目录
     * @param filesList 返回的文件地址
     */
    public static readFileList(path, filesList) {
        let files = fs.readdirSync(path);
        files.forEach((value) => {
            let status = fs.statSync(path + value);
            if (status.isDirectory()) {
                this.readFileList(path + value + "/", filesList)
            } else {
                if (value !== ".DS_Store") {
                    let obj: any = {};
                    obj.path = path;
                    obj.filename = value;
                    let dimensions = imageSize(path + value);
                    obj.width = dimensions.width;
                    obj.height = dimensions.height;
                    filesList.push(obj);
                }
            }
        })
    }
}
