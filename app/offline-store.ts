// Only the explicit opt-in snapshot is stored here. Auth tokens never enter IndexedDB.
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("evenfold-offline-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("snapshots");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function offlineStore<T>(owner: string, value?: T, remove = false): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("snapshots", value !== undefined || remove ? "readwrite" : "readonly");
    const store = transaction.objectStore("snapshots");
    const request = remove ? store.delete(owner) : value !== undefined ? store.put(value, owner) : store.get(owner);
    let result: T | undefined;
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}
