import { SingleFlight } from '../singleFlight';

describe('SingleFlight', () => {
  it('coalesces concurrent calls with the same key into one execution', async () => {
    const flight = new SingleFlight();
    let executions = 0;
    let release: (value: string) => void = () => {};
    const fn = () => {
      executions++;
      return new Promise<string>((resolve) => {
        release = resolve;
      });
    };

    const first = flight.run('key', fn);
    const second = flight.run('key', fn);
    const third = flight.run('key', fn);
    release('result');

    await expect(first).resolves.toBe('result');
    await expect(second).resolves.toBe('result');
    await expect(third).resolves.toBe('result');
    expect(executions).toBe(1);
  });

  it('runs different keys independently', async () => {
    const flight = new SingleFlight();
    let executions = 0;
    const fn = async () => {
      executions++;
      return executions;
    };

    await Promise.all([flight.run('a', fn), flight.run('b', fn)]);

    expect(executions).toBe(2);
  });

  it('starts a fresh flight after the previous one settles', async () => {
    const flight = new SingleFlight();
    let executions = 0;
    const fn = async () => {
      executions++;
      return executions;
    };

    const first = await flight.run('key', fn);
    const second = await flight.run('key', fn);

    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it('propagates errors to all joiners and clears the entry', async () => {
    const flight = new SingleFlight();
    let reject: (err: Error) => void = () => {};
    const fn = () =>
      new Promise<string>((_, rej) => {
        reject = rej;
      });

    const first = flight.run('key', fn);
    const second = flight.run('key', fn);
    reject(new Error('boom'));

    await expect(first).rejects.toThrow('boom');
    await expect(second).rejects.toThrow('boom');

    // A failed flight must not poison later calls
    await expect(flight.run('key', async () => 'recovered')).resolves.toBe('recovered');
  });
});
