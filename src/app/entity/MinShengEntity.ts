import TaskEntity from "../core/queue/TaskEntity";
import YouXinImplTask from "../core/queue/YouXinImplTask";
import {MinShengStatusEnum} from "../core/queue/MinShengStatusEnum";

export default class MinShengEntity extends TaskEntity {

    /** 程序索引 */
    public index: number = 0;
    /** 身份证号码 */
    public id: string = "";
    /** 放款时间 */
    public loanDate: string = "";
    /** 首次垫付时间 */
    public startAdvanceDate: string = "";
    /** 末次垫付时间 */
    public endAdvanceDate: string = "";
    /** 理财端借款标的id */
    public productCode: string = "";
    /** 合同编号 */
    public contractNo: string = "";
    /** 资产ID */
    public assetId: string = "";

    /** 民生网页地址 */
    public url: string = "";

    /** 输出路径 */
    public output: string = "";
    /** PDF输出路径 */
    public pdfOutput: string = "";
    /** 等待时间 */
    public waitTime: string = "";
    /** 状态 */
    public status: string = "";
    /** 错误码 */
    public errorCode: string = "";
    /** 组装的命令行 */
    public command: string = "";

    public youxinTask: YouXinImplTask = null;
    public youxinStatus: MinShengStatusEnum = MinShengStatusEnum.WAIT;
    public webStatus: MinShengStatusEnum = MinShengStatusEnum.WAIT;
    public pdfStatus: MinShengStatusEnum = MinShengStatusEnum.WAIT;
}
