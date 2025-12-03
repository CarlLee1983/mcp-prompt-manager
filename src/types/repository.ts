export interface Repository {
    /**
     * Sync the repository to the local storage.
     * @returns A promise that resolves when the sync is complete.
     */
    sync(): Promise<void>;
}

export interface RepositoryConfig {
    url: string;
    branch?: string;
    targetDir: string;
}
