import { AsyncSupplier, Collection, MapObject } from './types';

const reduceMerge = <T> (accum: Array<T>, target: Array<T> | T): Array<T> => {
  if (Array.isArray(target)) {
    accum.push.apply(accum, target);
  } else {
    accum.push(target);
  }
  return accum;
};

export const map = <T, U>(collection: Collection<T>,
                          // tslint:disable-next-line:no-any
                          f: (item: T, index: any) => U): Collection<U> => {
  if (Array.isArray(collection)) {
    return collection.map((value, index, _) => f(value, index));
  } else {
    const output: MapObject<U> = {};
    for (const key in collection) {
      if (!Object.prototype.hasOwnProperty.call(collection, key)) { continue; }
      const value = collection[key];
      output[key] = f(value, key);
    }
    return output;
  }
};

const getValues = <T>(collection: Collection<T>): Array<T> => {
  if (Array.isArray(collection)) {
    return collection.slice();
  } else {
    const values = [];
    for (const key in collection) {
      if (!Object.prototype.hasOwnProperty.call(collection, key)) { continue; }
      values.push(collection[key]);
    }
    return values;
  }
};

export const flatten = <T> (items: Collection<Array<T> | T>): Array<T> => {
  return getValues(items).reduce(reduceMerge, []);
};

const startThread = (tasks: Array<AsyncSupplier<void>>,
                     handle: CancelHandle): Promise<void> => {
  let p = Promise.resolve();
  tasks.forEach((task) => {
    p = p.then(task)
      .then(() => {
        if (handle.canceled) { throw new Error('canceled'); }
      });
  });
  return p;
};

export const runParallelTasks = (originalTasks: Collection<AsyncSupplier<void>>,
                                 limit: number): Promise<void> => {
  const tasks = getValues(originalTasks);
  const numThreads = Math.max(1, Math.min(tasks.length, limit));
  const chunkSize = Math.ceil(tasks.length / numThreads);
  const taskChunks: Array<Array<AsyncSupplier<void>>> = [];
  while (taskChunks.length < numThreads) {
    taskChunks.push(tasks.splice(0, chunkSize));
  }
  const handle: CancelHandle = {};
  const threadPromises = taskChunks.map((chunk) => startThread(chunk, handle));
  return Promise.all(threadPromises)
    .then(() => undefined)
    .catch((error) => {
      handle.canceled = true;
      throw error;
    });
};

export const mapParallelTasks = <T>(tasks: Collection<AsyncSupplier<T>>,
                                    limit: number): Promise<Collection<T>> => {
  let internalTasks;
  let output: Collection<T>;
  if (Array.isArray(tasks)) {
    const results: Array<T> = output = [];
    internalTasks = map(tasks, (task, index) => () => {
      return Promise.resolve().then(task).then((result) => {
        results[index] = result;
      });
    });
  } else {
    const results: MapObject<T> = output = {};
    internalTasks = map(tasks, (task, key) => () => {
      return Promise.resolve().then(task).then((result) => {
        results[key] = result;
      });
    });
  }
  return runParallelTasks(internalTasks, limit).then(() => output);
};

interface CancelHandle {
  canceled?: boolean;
}
