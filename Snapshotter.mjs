export class Snapshotter {
  constructor(canvas, length=16) {
    this.length = length;
    this.canvas = canvas;
    this.undos = [];
    this.redos = [];
  }

  _snapshot() {
    const frame = document.createElement('canvas');
    frame.width = this.canvas.width;
    frame.height = this.canvas.height;
    const c = frame.getContext('2d');
    c.drawImage(this.canvas, 0, 0);
    return frame;
  }

  _apply(frame) {
    const c = this.canvas.getContext('2d');
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(frame, 0, 0);
  }

  save() {
    this.undos.push(this._snapshot());
    if (this.undos.length > this.length) {
      this.undos.shift();
    }
    this.redos.length = 0;
  }

  undo() {
    if (this.undos.length === 0) {
      return;
    }
    this.redos.push(this._snapshot());
    const frame = this.undos.pop();
    this._apply(frame);
  }

  redo() {
    if (this.redos.length === 0) {
      return;
    }
    this.undos.push(this._snapshot());
    const frame = this.redos.pop();
    this._apply(frame);
  }
}
