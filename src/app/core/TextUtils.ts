/**
 * 字符串工具类
 */
export default class TextUtils {
    /**
     * 判断字符是否为空的方法
     */
    static isEmpty(obj: any): boolean {
        return obj == null || typeof obj === "undefined" || obj === "";
    }

    /**
     * 时间格式化 取消后台返回的 毫秒数
     * @param date
     * @returns {string}
     */
    static dataSubstringMS(date: any) {
        if (date == null || date === undefined || date === '') {
            return '';
        }
        return date.substring(0, date.indexOf('.'));
    }

    /**
     * 将数字转化成百分比，并保留小数点1位
     */
    static dataPercentToFixed(num: number) {
        if (num) {
            num = num * 100;
            return num.toFixed(1);
        }
        return num;
    }

    /**
     * 自动补零
     * @param num
     * @return {string}
     */
    static numToFixed(num: number) {
        if (!num || Number(num) < 0) {
            return "0.00";
        }
        return num.toFixed(2);
    }
}
