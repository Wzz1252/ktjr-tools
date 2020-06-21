export interface TaskStartListener<DATA> {
    (data: DATA): void;
}

export interface TaskSuccessListener<DATA> {
    (data: DATA): void;
}

export interface TaskFailListener<DATA> {
    (data: DATA): void;
}
