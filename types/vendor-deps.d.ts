declare module "@neondatabase/serverless" {
  export interface QueryResult<Row = Record<string, unknown>> {
    rows: Row[];
    rowCount: number | null;
  }

  export interface PoolClient {
    query<Row = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<Row>>;
    release(): void;
  }

  export class Pool {
    constructor(config: { connectionString: string });
    connect(): Promise<PoolClient>;
    query<Row = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<Row>>;
    end(): Promise<void>;
  }
}
