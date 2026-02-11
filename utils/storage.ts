
const DB_NAME = 'TranslationAppDB';
const STORE_NAME = 'app_session';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }

    // Reuse existing connection if valid
    if (dbInstance) {
        resolve(dbInstance);
        return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("IndexedDB Open Error:", (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        
        // Handle connection closing (e.g. adjacent tabs)
        dbInstance.onversionchange = () => {
            dbInstance?.close();
            dbInstance = null;
        };
        dbInstance.onclose = () => {
            dbInstance = null;
        };

        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      
      // Safety timeout for browsers that lock IDB (like Cốc Cốc sometimes does)
      setTimeout(() => {
          if (request.readyState === 'pending') {
              // Don't reject, just warn. The callback might still happen.
              console.warn("IndexedDB open request is taking longer than expected...");
          }
      }, 3000);

    } catch (e) {
      reject(e);
    }
  });
};

export const saveToStorage = async (key: string, data: any): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      } catch (e) {
        // If transaction fails (e.g. database closed unexpectedly), reset instance and retry once
        dbInstance = null;
        reject(e);
      }
    });
  } catch (error) {
    console.warn('Lỗi lưu trữ:', error);
    throw error; // Re-throw to let hook handle it
  }
};

export const loadFromStorage = async (key: string): Promise<any> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      } catch (e) {
        dbInstance = null;
        reject(e);
      }
    });
  } catch (error) {
    console.warn('Lỗi đọc lưu trữ:', error);
    return null;
  }
};

/**
 * Reset App V4: Soft Reset Support
 * Đóng kết nối và xóa Database.
 * Resolve promise ngay cả khi blocked để UI không bị treo.
 */
export const clearDatabase = async (): Promise<void> => {
  // 1. Cưỡng chế đóng kết nối hiện tại để nhả khóa
  if (dbInstance) {
    try {
        dbInstance.close();
    } catch(e) { /* ignore */ }
    dbInstance = null;
  }
  
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.deleteDatabase(DB_NAME);
      
      req.onsuccess = () => resolve();
      req.onerror = () => {
          console.warn("DB Delete Error (Ignored)");
          resolve();
      };
      req.onblocked = () => {
          console.warn("DB Delete Blocked (Ignored)");
          resolve();
      };
    } catch (e) {
      resolve();
    }
  });
};
