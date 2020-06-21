export default interface TaskCallbackListener<DATA> {
    (statue: any, data: DATA): void;
}
