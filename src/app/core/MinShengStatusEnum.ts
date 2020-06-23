/**
 * 任务状态
 */
export enum MinShengStatusEnum {
    WAIT = "WAIT",
    RUNNING = "RUNNING",
    SUCCESS = "SUCCESS",
    ERROR = "ERROR",
    WARN = "WARN",
    DATA_NULL = "DATA_NULL", // 数据为NULL
    MAKE_DIR_FAIL = "MAKE_DIR_FAIL", // 目录创建失败
    WRITE_FAIL = "WRITE_FAIL", // 文件写入
    UNKNOWN = "UNKNOWN", // 未知错误
}


