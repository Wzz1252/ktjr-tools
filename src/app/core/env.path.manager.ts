import {join} from "path";

const os = require("os");

export default class EnvPathManager {
    /**
     * 是否是生产环境
     * @return true 是， false 否
     */
    public static isProduction(): boolean {
        return process.env.NODE_ENV === "production";
    }

    /**
     * 是否是测试环境
     * @return true 是， false 否
     */
    public static isDebug(): boolean {
        return process.env.NODE_ENV !== "production";
    }

    /**
     * 获得项目目录
     * 如果是生产环境返回打包后的目录
     * 如果是测试环境返回指定的测试目录
     */
    public static getDirNamePath(): string {
        let dirname = __dirname;
        if (this.isDebug()) {
            // dirname = "写死";
        }
        return dirname;
    }

    /**
     * 返回操作系统信息
     */
    public static getPlatform(): string {
        return os.platform();
    }

    /**
     * 是否是 Mac 系统
     * @return true 是， false 否
     */
    public static isMacosx(): boolean {
        return this.getPlatform() === "darwin";
    }

    /**
     * 根据系统自动返回合适的 phantomjs 版本
     * 目前只支持 Windows 和 Mac
     */
    public static getPhantomjsPath(): string {
        let phantomjsName = "";
        if (this.isMacosx()) {
            phantomjsName = "phantomjs-macosx";
        } else {
            phantomjsName = "phantomjs-windows";
        }

        let path = join(this.getDirNamePath(), "..", "..", "extraResources", phantomjsName, "bin", "phantomjs");
        if (this.isDebug()) {
            // 为方便测试，将路径写死
            path = `./src/extraResources/${phantomjsName}/bin/phantomjs`;
        }
        return path;
    }

    /**
     * 返回 js 执行文件
     */
    public static getPjs(): string {
        let fileName = "MinShengBack.js";
        let path = join(this.getDirNamePath(), '..', '..', 'extraResources', fileName);
        if (this.isDebug()) {
            // 为方便测试，将路径写死
            path = `./src/extraResources/${fileName}`;
        }
        return path;
    }

}
