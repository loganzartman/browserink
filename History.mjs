export class History {
  constructor(eventNode) {
    this.eventNode = eventNode;
    this.history = [];
    this.index = 0;
    this.recording = true;

    this.eventNode.onAll((event) => this.recording && this.push(event));
  }

  _seekForward(name, callback) {
    while (this.index < this.history.length - 1) {
      ++this.index;
      const event = this.history[this.index];
      if (event.name === name) {
        break;
      }
      callback && callback(event);
    }
  }

  _seekBackward(name, callback) {
    while (this.index > 0) {
      --this.index;
      const event = this.history[this.index];
      if (event.name === name) {
        break;
      }
      callback && callback(event);
    }
  }

  push(event) {
    if (this.index !== this.history.length - 1) {
      this.history.splice(this.index);
    }
    this.history.push(event);
    this.index = this.history.length - 1;
  }

  undo() {
    this.recording = false;
    this.eventNode.emit({name: 'clear'});
    this._seekBackward('checkpoint');
    const last = this.index;
    this._seekBackward('clear');

    while (this.index < last) {
      const event = this.history[this.index];
      this.eventNode.emit(event);
      ++this.index;
    }
    this.recording = true;
  }

  redo() {
    this.recording = false;
    this._seekForward('checkpoint', (event) => {
      this.eventNode.emit(event);
    });
    this.recording = true;
  }
}