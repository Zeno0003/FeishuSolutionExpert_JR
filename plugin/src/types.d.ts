/// <reference types="react" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module '@lark-base-open/js-sdk' {
  interface ITable {
    getRecords(params?: {
      filter?: string;
      pageSize?: number;
      pageToken?: string;
    }): Promise<{ records: IRecord[]; pageToken?: string }>;
    addRecord(params: { fields: Record<string, unknown> }): Promise<{ record: IRecord }>;
    updateRecord(
      recordId: string,
      params: { fields: Record<string, unknown> }
    ): Promise<{ record: IRecord }>;
    getFields(): Promise<IField[]>;
  }

  interface IRecord {
    id: string;
    fields: Record<string, unknown>;
  }

  interface IField {
    id: string;
    name: string;
    type: string;
  }

  interface IBase {
    getTableByName(name: string): Promise<ITable>;
    getTableById(id: string): Promise<ITable>;
  }

  export const bitable: {
    base: IBase;
  };
}
