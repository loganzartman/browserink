// creates a JSON.stringify replacer function that stops recursion
// when it encounters circular references.
const noCyclesReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[[Circular]]';
      }
      seen.add(value);
    }
    return value;
  };
};

export class DebugRenderer {
  constructor(eventNode) {
    this.eventNode = eventNode;
    this.textValues = new Map();

    this.eventNode.on('debugText', ({key, value}) => {
      this.textValues.set(key, value);
    });
  }
  
  render(context) {
    const fontSize = 20;
    context.save();
    context.translate(16, 16);
    context.font = `${fontSize}px monospace`;
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.lineJoin = 'round';

    let i = 0;
    let y = 0;
    for (const [key, value] of this.textValues) {
      const text = `${key}: ${JSON.stringify(value, noCyclesReplacer(), 2)}`;
      const metrics = context.measureText(text);
      let height = fontSize;
      if (metrics.fontBoundingBoxAscent) {
        height = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      }
      context.fillStyle = `hsl(${i * 360 / this.textValues.size}, 100%, 80%)`;
      for (const line of text.split('\n')) {
        context.lineWidth = 8;
        context.strokeStyle = 'rgba(0,0,0,0.8)';
        context.strokeText(line, 0, y);
        context.fillText(line, 0, y);
        y += height;
      }
      i += 1;
    }

    context.restore();
  }
}