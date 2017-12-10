const parallel = require('../src/parallel');
const { createSleepTasks, createSleepTasksAndStats } = require('./utils');

it('should run all tasks at once', async () => {
  const { stats, tasks } = createSleepTasksAndStats(25);
  await parallel(tasks);
  expect(stats.maxActive).toBe(tasks.length);
});

it('should return results in order', async () => {
  const tasks = createSleepTasks(3);
  const result = await parallel(tasks);
  expect(result).toEqual([0, 1, 2]);
});
