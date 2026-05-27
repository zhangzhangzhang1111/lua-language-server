export function encodeLspMessage(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.from(`Content-Length: ${body.byteLength}\r\n\r\n`, 'ascii');
  return Buffer.concat([header, body]);
}

export class LspMessageFramer {
  #buffer = Buffer.alloc(0);
  #listeners = new Set();

  onMessage(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  push(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, Buffer.from(chunk)]);

    while (true) {
      const headerEnd = this.#buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }

      const header = this.#buffer.subarray(0, headerEnd).toString('ascii');
      const lengthMatch = /^Content-Length:\s*(\d+)$/im.exec(header);
      if (!lengthMatch) {
        throw new Error(`Invalid LSP message header: ${header}`);
      }

      const bodyLength = Number.parseInt(lengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      const messageEnd = bodyStart + bodyLength;
      if (this.#buffer.byteLength < messageEnd) {
        return;
      }

      const rawBody = this.#buffer.subarray(bodyStart, messageEnd).toString('utf8');
      const message = JSON.parse(rawBody);
      this.#buffer = this.#buffer.subarray(messageEnd);

      for (const listener of this.#listeners) {
        listener(message);
      }
    }
  }
}
