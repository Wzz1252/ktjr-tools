export default class Logger {

    /**
     * 是否显示时间
     */
    private static isShowDate: boolean = true;
    /**
     * 是否显示日志级别
     */
    private static isShowLevel: boolean = true;
    /**
     * 是否显示日志标签
     */
    private static isShowTag: boolean = true;

    static log(tag: string, ...optionalParams: any) {
        // if (Configs.getInstance().IS_DEBUG) {
        console.log(this.buildConsole("INFO", tag), '', 'color:black;font-weight:bold;', ...optionalParams);
        // }
    }

    static logFocus(tag: string, ...optionalParams: any) {
        // if (Configs.getInstance().IS_DEBUG) {
        console.log(this.buildConsole("INFO", tag), '', 'color:#ff0;font-weight:bold;', ...optionalParams);
        // }
    }

    static warn(tag: any, ...optionalParams: any) {
        // if (Configs.getInstance().IS_DEBUG) {
        console.warn(this.buildConsole("WARN", tag), ...optionalParams);
        // }
    }

    static error(tag: any, ...optionalParams: any) {
        // if (Configs.getInstance().IS_DEBUG) {
        console.error(this.buildConsole("ERROR", tag), ...optionalParams);
        // }
    }

    // 过时
    static info(tag: any, ...optionalParams: any) {
        // if (Configs.getInstance().IS_DEBUG) {
        console.info(this.buildConsole("INFO", tag), ...optionalParams);
        // }
    }

    static buildConsole(levelStr: string, tagStr: string) {
        let isShowColor: boolean = levelStr != "ERROR" && levelStr != "WARN";
        let date = Logger.isShowDate ? ((isShowColor ? "%c" : "") + this.__formatTimestamp(new Date()) + " ") : "";
        let level = Logger.isShowLevel ? levelStr + " " : "";
        let tag = Logger.isShowTag ? ((isShowColor ? "%c" : "") + ("[") + tagStr + "]") : "";

        return date + level + tag;
    }

    static __formatTimestamp(timestamp: Date) {
        let year = timestamp.getFullYear();
        let date = timestamp.getDate();
        let month = ('0' + (timestamp.getMonth() + 1)).slice(-2);
        let hrs = Number(timestamp.getHours());
        let mins = ('0' + timestamp.getMinutes()).slice(-2);
        let secs = ('0' + timestamp.getSeconds()).slice(-2);
        let milliseconds = ('00' + timestamp.getMilliseconds()).slice(-3);
        return year + '-' + month + '-' + date + ' ' + hrs + ':' + mins + ':' + secs + '.' + milliseconds;
    }
}
