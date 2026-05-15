import type IORedis from 'ioredis';
export type SyncState = {
    isScanning: boolean;
    total: number;
    current: number;
};
export declare function getSyncState(redis: IORedis | null): Promise<SyncState>;
export declare function setSyncState(redis: IORedis | null, patch: Partial<SyncState>): Promise<SyncState>;
export declare function resetSyncState(redis: IORedis | null): Promise<void>;
//# sourceMappingURL=syncStateStore.d.ts.map