import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SocketProvider, useSocket } from './SocketProvider';

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('@/src/lib/socket', () => ({
  getSocket: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
}));

vi.mock('@/src/lib/constants', () => ({
  BACKEND_URL: 'http://localhost:3000',
}));

function TestConsumer() {
  const { socket, isConnected } = useSocket();
  return (
    <div>
      <span data-testid="connected">{isConnected ? 'yes' : 'no'}</span>
      <span data-testid="has-socket">{socket ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('SocketProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it('should fetch /player/me before connecting socket', async () => {
    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/player/me',
        { credentials: 'include' },
      );
    });

    await waitFor(() => {
      expect(mockSocket.connect).toHaveBeenCalled();
    });
  });

  it('should register event listeners before calling connect', async () => {
    const callOrder: string[] = [];
    mockSocket.on.mockImplementation(() => { callOrder.push('on'); });
    mockSocket.connect.mockImplementation(() => { callOrder.push('connect'); });

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>,
    );

    await waitFor(() => {
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    // on('connect'), on('disconnect') should be called before connect()
    expect(callOrder).toEqual(['on', 'on', 'connect']);
  });

  it('should set isConnected to true when socket emits connect', async () => {
    let connectHandler: (() => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: () => void) => {
      if (event === 'connect') connectHandler = handler;
    });

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>,
    );

    await waitFor(() => {
      expect(connectHandler).toBeDefined();
    });

    act(() => {
      connectHandler!();
    });

    expect(screen.getByTestId('connected').textContent).toBe('yes');
  });

  it('should set isConnected to false when socket emits disconnect', async () => {
    let connectHandler: (() => void) | undefined;
    let disconnectHandler: (() => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: () => void) => {
      if (event === 'connect') connectHandler = handler;
      if (event === 'disconnect') disconnectHandler = handler;
    });

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>,
    );

    await waitFor(() => {
      expect(connectHandler).toBeDefined();
    });

    act(() => { connectHandler!(); });
    expect(screen.getByTestId('connected').textContent).toBe('yes');

    act(() => { disconnectHandler!(); });
    expect(screen.getByTestId('connected').textContent).toBe('no');
  });

  it('should still connect socket when fetch fails', async () => {
    (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>,
    );

    await waitFor(() => {
      expect(mockSocket.connect).toHaveBeenCalled();
    });
  });

  it('should remove event listeners on unmount', async () => {
    const { unmount } = render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>,
    );

    await waitFor(() => {
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    const { disconnectSocket } = await import('@/src/lib/socket');

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(disconnectSocket).toHaveBeenCalled();
  });

  it('should not connect socket if unmounted before fetch completes', async () => {
    let resolvePromise: () => void;
    (global.fetch as Mock).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolvePromise = () => resolve(new Response());
      }),
    );

    const { unmount } = render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>,
    );

    unmount();

    await act(async () => {
      resolvePromise!();
    });

    // getSocket should not have been called since cancelled was set before fetch resolved
    const { getSocket } = await import('@/src/lib/socket');
    expect(getSocket).not.toHaveBeenCalled();
  });

  it('should provide null socket and false isConnected by default', () => {
    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>,
    );

    expect(screen.getByTestId('connected').textContent).toBe('no');
    expect(screen.getByTestId('has-socket').textContent).toBe('no');
  });
});
