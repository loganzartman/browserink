export class EventNode {
  constructor() {
    this.listeners = {};
    this.allListeners = [];
  }

  on(eventName, listener) {
    this.listeners[eventName] ??= [];
    this.listeners[eventName].push(listener);
  }

  onAll(listener) {
    this.allListeners.push(listener);
  }
  
  emit(event) {
    if (!event.name) {
      throw new Error('Event has no name!');
    }

    this.listeners[event.name]?.forEach(listener => listener(event));
    this.allListeners.forEach(listener => listener(event));
  }
}