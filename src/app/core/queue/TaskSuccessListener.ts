export interface TaskSuccessListener<DATA> {
    (data: DATA): void;
}

export interface TaskFailListener<DATA> {
    (data: DATA): void;
}
