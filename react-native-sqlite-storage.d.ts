declare module 'react-native-sqlite-storage' {
  export interface SQLiteDatabase {
    executeSql(
      sql: string,
      params?: any[]
    ): Promise<[SQLiteResultSet]>;
    close(): Promise<void>;
  }

  export interface SQLiteResultSet {
    rows: {
      length: number;
      item(index: number): any;
    };
    rowsAffected: number;
    insertId?: number;
  }

  export interface SQLiteParams {
    name: string;
    location?: string;
  }

  export interface SQLiteStatic {
    DEBUG(enable: boolean): void;
    enablePromise(enable: boolean): void;
    openDatabase(
      params: SQLiteParams
    ): Promise<SQLiteDatabase>;
  }

  const SQLite: SQLiteStatic & {
    SQLiteDatabase: SQLiteDatabase;
  };
  
  export default SQLite;
}

