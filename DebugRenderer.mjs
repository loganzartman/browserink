export class DebugRenderer {
  constructor(eventNode) {
    this.eventNode = eventNode;
    this.textValues = new Map();

    this.eventNode.on('debugText', ({key, value}) => {
      this.textValues.set(key, value);
    });
  }
  
  render(context) {
    context.save();
    context.translate(16, 16);
    context.font = '24px monospace';
    context.textAlign = 'left';
    context.textBaseline = 'top';

    let i = 0;
    let y = 0;
    for (const [key, value] of this.textValues) {
      const text = `${key}: ${JSON.stringify(value, undefined, 2)}`;
      const metrics = context.measureText(text);
      const height = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      context.fillStyle = `hsl(${i * 360 / this.textValues.size}, 100%, 50%)`;
      context.lineWidth = 2;
      context.strokeStyle = 'white';
      for (const line of text.split('\n')) {
        context.strokeText(line, 0, y);
        context.fillText(line, 0, y);
        y += height;
      }
      i += 1;
    }

    context.restore();
  }
}