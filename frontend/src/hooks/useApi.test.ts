/**
 * SmartWealth AI - useApi Hook Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApi, useMutation } from './useApi';
import { ApiError } from '../services/api';

describe('useApi', () => {
  it('starts with initial state (no data, not loading, no error)', () => {
    const apiFn = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() => useApi(apiFn));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading state during execution', async () => {
    let resolveFn: (value: string) => void;
    const apiFn = vi.fn().mockImplementation(
      () => new Promise<string>((resolve) => { resolveFn = resolve; }),
    );

    const { result } = renderHook(() => useApi(apiFn));

    act(() => {
      result.current.execute();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveFn!('done');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('done');
  });

  it('sets data on successful execution', async () => {
    const apiFn = vi.fn().mockResolvedValue({ items: [1, 2, 3] });
    const { result } = renderHook(() => useApi(apiFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toEqual({ items: [1, 2, 3] });
    expect(result.current.error).toBeNull();
  });

  it('sets error on failed execution', async () => {
    const apiError = new ApiError(404, 'Not Found', { message: 'Session not found' });
    const apiFn = vi.fn().mockRejectedValue(apiError);
    const { result } = renderHook(() => useApi(apiFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(apiError);
    expect(result.current.loading).toBe(false);
  });

  it('wraps non-Error/ApiError exceptions as Error', async () => {
    const apiFn = vi.fn().mockRejectedValue('string error');
    const { result } = renderHook(() => useApi(apiFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });

  it('passes arguments through to the API function', async () => {
    const apiFn = vi.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useApi(apiFn));

    await act(async () => {
      await result.current.execute('arg1', 42);
    });

    expect(apiFn).toHaveBeenCalledWith('arg1', 42);
  });

  it('handles race conditions by ignoring stale responses', async () => {
    let call = 0;
    const apiFn = vi.fn().mockImplementation(() => {
      call++;
      const currentCall = call;
      return new Promise((resolve) => {
        // First call resolves slower than second
        setTimeout(() => resolve(`result-${currentCall}`), currentCall === 1 ? 100 : 10);
      });
    });

    const { result } = renderHook(() => useApi(apiFn));

    await act(async () => {
      // Fire two requests quickly - the second should win
      result.current.execute();
      result.current.execute();
      // Wait for both to resolve
      await new Promise((r) => setTimeout(r, 150));
    });

    // Second request should win
    expect(result.current.data).toBe('result-2');
  });

  it('resets state back to initial', async () => {
    const apiFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useApi(apiFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBe('data');

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns the result from execute', async () => {
    const apiFn = vi.fn().mockResolvedValue('returned-value');
    const { result } = renderHook(() => useApi(apiFn));

    let returnedValue: unknown;
    await act(async () => {
      returnedValue = await result.current.execute();
    });

    expect(returnedValue).toBe('returned-value');
  });

  it('returns null from execute on error', async () => {
    const apiFn = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useApi(apiFn));

    let returnedValue: unknown;
    await act(async () => {
      returnedValue = await result.current.execute();
    });

    expect(returnedValue).toBeNull();
  });
});

describe('useMutation', () => {
  it('starts with not loading and no error', () => {
    const apiFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useMutation(apiFn));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('tracks loading state during mutation', async () => {
    let resolveFn: () => void;
    const apiFn = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveFn = resolve; }),
    );

    const { result } = renderHook(() => useMutation(apiFn));

    act(() => {
      result.current.execute();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveFn!();
    });

    expect(result.current.loading).toBe(false);
  });

  it('returns result on success', async () => {
    const apiFn = vi.fn().mockResolvedValue({ id: 'new-goal' });
    const { result } = renderHook(() => useMutation(apiFn));

    let returnedValue: unknown;
    await act(async () => {
      returnedValue = await result.current.execute('arg1');
    });

    expect(returnedValue).toEqual({ id: 'new-goal' });
    expect(result.current.error).toBeNull();
  });

  it('sets error on failure', async () => {
    const apiError = new ApiError(422, 'Unprocessable', { field: 'goalName' });
    const apiFn = vi.fn().mockRejectedValue(apiError);
    const { result } = renderHook(() => useMutation(apiFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toBe(apiError);
    expect(result.current.loading).toBe(false);
  });

  it('resets error state', async () => {
    const apiFn = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useMutation(apiFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
