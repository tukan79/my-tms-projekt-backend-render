import { useEffect, useCallback } from 'react';

const channel = new BroadcastChannel('tms_state_sync');

/**
 * A custom hook to synchronize state across multiple browser windows/tabs.
 * @param {Function} onMessage - A callback function to execute when a message is received.
 */
export const useBroadcastChannel = (onMessage) => {
  useEffect(() => {
    const handleMessage = (event) => {
      if (onMessage) {
        onMessage(event.data);
      }
    };

    channel.addEventListener('message', handleMessage);

    // Cleanup function to remove the event listener when the component unmounts
    return () => {
      channel.removeEventListener('message', handleMessage);
    };
  }, [onMessage]);

  /**
   * Broadcasts a message to all other listening windows/tabs.
   * @param {any} message - The data to be sent.
   */
  const postMessage = useCallback((message) => {
    channel.postMessage(message);
  }, []);

  return { postMessage };
};