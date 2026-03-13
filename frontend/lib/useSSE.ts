import { useEffect, useRef, useState } from 'react';

export interface SSEMessage {
  type: 'step' | 'result' | 'error' | 'complete';
  data: any;
}

export function useSSE(url: string | null, onMessage: (message: SSEMessage) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) {
      // Close existing connection if URL becomes null
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Create new EventSource connection
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);
        onMessage(message);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      setError(new Error('Connection error'));
      setIsConnected(false);
      
      // EventSource will automatically try to reconnect
      // Close it if we want to stop reconnection attempts
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
        eventSourceRef.current = null;
      }
    };

    // Cleanup on unmount or URL change
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [url, onMessage]);

  const close = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  };

  return { isConnected, error, close };
}
