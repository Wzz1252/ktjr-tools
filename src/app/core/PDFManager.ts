const imageSize = require('image-size');
const fs = require("fs");

export default class PDFManager {
    /**
     * 获取指定目录下的所有文件
     * @param path      文件夹目录
     * @param filesList 返回的文件地址
     */
    public static readJPEGFileList(path: string, filesList: Array<any>) {
        let files = fs.readdirSync(path);
        files.forEach((value) => {
            let status = fs.statSync(path + value);
            if (status.isDirectory()) {
                this.readJPEGFileList(path + value + "/", filesList)
            } else {
                if (value !== ".DS_Store" || value.indexOf(".jpeg") != -1) {
                    let dimensions = imageSize(path + value);
                    let obj: any = {};
                    obj.path = path;
                    obj.filename = value;
                    obj.width = dimensions.width;
                    obj.height = dimensions.height;
                    filesList.push(obj);
                }
            }
        })
    }

    /**
     * 对 jpeg 进行升序排序
     * @param filesList 文件列表
     */
    public static jpegSort(filesList: Array<any>) {
        let compare = function (o1, o2) {
            if (o1.filename < o2.filename) {
                return -1;
            } else if (o1.filename > o2.filename) {
                return 1;
            } else {
                return 0;
            }
        }
        filesList.sort(compare);
    }
}
